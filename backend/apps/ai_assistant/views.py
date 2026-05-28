
import json
import logging

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import ChatSession, ChatMessage
from .serializers import ChatInputSerializer, ChatSessionSerializer, ChatMessageSerializer, RoomRecommendationInputSerializer

logger = logging.getLogger("apps.ai_assistant")

ARIA_PROMPT = """You are ARIA (Enayi's AI Receptionist & Interactive Assistant), the intelligent virtual concierge of Enayi Hotels & Suites, located on Rayfield Road, Jos, Plateau State, Nigeria.

Persona: Warm, professional, and genuinely helpful. You speak with the warmth of Nigerian hospitality.

HOTEL INFORMATION:
- Address: Rayfield Road, Jos, Plateau State, Nigeria
- Phone: +234-800-000-0000 | Email: info@enayihotels.com
- Check-in: 2:00 PM | Check-out: 12:00 PM | Front Desk: 24/7

ROOMS & PRICING (NGN per night):
- Standard Room: ₦35,000 (Queen bed, 28sqm, 2 guests max)
- Deluxe Room: ₦55,000 (King bed, 42sqm, city view, 2 guests max)
- Executive Suite: ₦85,000 (King bed + living room, 68sqm, 3 guests max)
- Presidential Suite: ₦150,000 (2 bedrooms, 120sqm, butler service, 4 guests max)

All rooms: Free Wi-Fi, Smart TV, 24hr AC, minibar, daily housekeeping.

FOOD & DRINKS:
- Room service: 24 hours
- Restaurant: Breakfast 6am-11am, Lunch 12pm-4pm, Dinner 6pm-10pm
- Bar & Lounge: Open until midnight
- Pool-side snacks available during pool hours

EVENT HALLS:
- Royal Banquet Hall: 500 guests seated
- Executive Conference: 80 delegates
- Garden Pavilion: 200 guests
- Intimate Lounge: 30 guests

PAYMENTS:
Flutterwave, Paystack, Stripe, PayPal, USSD, Bank Transfer, Cash, POS.

Respond concisely. Use ₦ for prices. If you cannot help, direct the guest to call +234-800-000-0000.
"""


class ARIAConciergeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        s = ChatInputSerializer(data=request.data)

        if not s.is_valid():
            return Response(s.errors, status=400)

        message = s.validated_data["message"].strip()
        session_id = s.validated_data.get("session_id")

        if session_id:
            try:
                session = ChatSession.objects.get(
                    id=session_id,
                    user=request.user
                )
            except ChatSession.DoesNotExist:
                session = ChatSession.objects.create(
                    user=request.user
                )
        else:
            session = ChatSession.objects.create(
                user=request.user
            )

        ChatMessage.objects.create(
            session=session,
            role="user",
            content=message
        )

        history = list(
            session.messages.order_by("created_at").values(
                "role",
                "content"
            )
        )

        messages_payload = [
            {
                "role": "system",
                "content": ARIA_PROMPT
            }
        ] + [
            {
                "role": m["role"],
                "content": m["content"]
            }
            for m in history
        ]

        try:
            from openai import OpenAI

            client = OpenAI(
                api_key=settings.OPENAI_API_KEY
            )

            response = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=messages_payload,
                max_tokens=700,
                temperature=0.7
            )

            reply = response.choices[0].message.content
            tokens = response.usage.total_tokens

            ChatMessage.objects.create(
                session=session,
                role="assistant",
                content=reply,
                tokens=tokens
            )

            if session.messages.count() <= 2:
                session.title = message[:80] + (
                    "..." if len(message) > 80 else ""
                )

            session.save(
                update_fields=["title", "updated_at"]
            )

            return Response({
                "reply": reply,
                "session_id": str(session.id),
                "tokens": tokens
            })

        except Exception as e:
            logger.error(f"ARIA error: {e}")

            fallback = (
                "I apologise — our AI service is temporarily unavailable. "
                "Please contact the front desk at +234-800-000-0000 "
                "for assistance. We're available 24/7!"
            )

            ChatMessage.objects.create(
                session=session,
                role="assistant",
                content=fallback
            )

            return Response({
                "reply": fallback,
                "session_id": str(session.id)
            })


class ChatHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id=None):
        if session_id:
            try:
                session = ChatSession.objects.get(
                    id=session_id,
                    user=request.user
                )

                return Response({
                    "session_id": str(session.id),
                    "title": session.title,
                    "messages": ChatMessageSerializer(
                        session.messages.order_by("created_at"),
                        many=True
                    ).data
                })

            except ChatSession.DoesNotExist:
                return Response(
                    {"error": "Session not found."},
                    status=404
                )

        sessions = ChatSession.objects.filter(
            user=request.user
        ).order_by(
            "-updated_at"
        )[:20]

        return Response(
            ChatSessionSerializer(
                sessions,
                many=True
            ).data
        )

    def delete(self, request, session_id):
        try:
            session = ChatSession.objects.get(
                id=session_id,
                user=request.user
            )

            session.delete()

            return Response({
                "message": "Session deleted."
            })

        except ChatSession.DoesNotExist:
            return Response(
                {"error": "Not found."},
                status=404
            )


class RoomRecommendationView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        s = RoomRecommendationInputSerializer(data=request.data)

        if not s.is_valid():
            return Response(s.errors, status=400)

        prefs = s.validated_data

        prompt = f"""Guest preferences for Enayi Hotels & Suites, Jos Nigeria:
- Budget: ₦{prefs.get('budget','flexible')}/night
- Guests: {prefs.get('guests',2)}
- Nights: {prefs.get('nights',1)}
- Purpose: {prefs.get('purpose','leisure')}
- Special: {prefs.get('special_needs','none')}

Rooms:
1. Standard — ₦35,000/night | Queen bed, 28sqm
2. Deluxe — ₦55,000/night | King bed, 42sqm, city view
3. Executive Suite — ₦85,000/night | King bed + living room, 68sqm
4. Presidential Suite — ₦150,000/night | 2 bedrooms, 120sqm, butler

Reply ONLY with valid JSON.
"""

        try:
            from openai import OpenAI

            client = OpenAI(
                api_key=settings.OPENAI_API_KEY
            )

            resp = client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=300,
                temperature=0.3
            )

            content = resp.choices[0].message.content.strip()
            start = content.find("{")
            end = content.rfind("}") + 1

            return Response(
                json.loads(content[start:end])
            )

        except Exception as e:
            logger.error(f"Recommendation error: {e}")

            return Response({
                "recommended_room": "Deluxe Room",
                "reason": "Our most popular choice for most guests.",
                "alternative": "Executive Suite",
                "estimated_total": 55000,
                "tips": [
                    "Book early for best rates",
                    "Breakfast is included on request"
                ]
            })
