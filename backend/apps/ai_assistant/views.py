"""
Enayi Hotels — AI Concierge (ENAYI)
Powered by Anthropic's Claude API.

Environment variables required on Render:
  ANTHROPIC_API_KEY   — your Anthropic API key
                        (Settings → Environment → Add environment variable)

The key is NEVER committed to git — it lives only in Render's
environment variable store. If ANTHROPIC_API_KEY is missing or blank,
ENAYI falls back to a friendly offline message and logs the failure.
"""
import json
import logging

from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import ChatSession, ChatMessage
from .serializers import (
    ChatInputSerializer, ChatSessionSerializer,
    ChatMessageSerializer, RoomRecommendationInputSerializer,
)

logger = logging.getLogger("apps.ai_assistant")

# ── System prompt ────────────────────────────────────────────────
# This is what ENAYI "knows" about the hotel before any guest message.
# Update prices, room types, and services here as the hotel evolves.
ENAYI_SYSTEM_PROMPT = """You are ENAYI, the intelligent AI concierge of Enayi Hotels & Suites in Jos, Plateau State, Nigeria.

Persona: Warm, professional, and genuinely helpful — you speak with the warmth of Nigerian hospitality. You are knowledgeable, friendly, and always eager to make every guest feel welcome and well-served.

HOTEL INFORMATION:
- Two branches: Rayfield (main) and Zarmaganda
- Address: Rayfield Road, Jos, Plateau State, Nigeria
- Phone: +234 (0) 913 894 3008 | Email: info@enayihotels.com
- Check-in: 2:00 PM | Check-out: 12:00 PM | Front Desk: 24 hours, 7 days

ROOMS & PRICING (NGN per night):
- Standard Room: ₦40,000 (Queen bed, 28sqm, 2 guests max)
- Class Plus: ₦75,000 (King bed, 42sqm, city view, 2 guests max)
- Executive Deluxe: ₦150,000 (King bed + living room, 68sqm, 3 guests max)
- Suite: Premium pricing — contact front desk

All rooms include: Free Wi-Fi, Smart TV, 24hr air conditioning, minibar, daily housekeeping.

FOOD & BAR (110+ items on the guest menu):
- Full food menu: Breakfast, Rice Specialties, Swallow & Traditional Soups, Pasta, Beans & Porridge, Enayi's Signature & Local Delicacies, Sides, Soups & Proteins
- Bar: Beers, Spirits & Wines, Soft Drinks & Mixers
- Room Service: 24 hours — guests order directly from the app
- Restaurant dining also available on-site
- Guests can browse the full menu and place orders from their Guest Portal

EVENT HALLS:
- Royal Banquet Hall: 500 guests seated
- Executive Conference: 80 delegates
- Garden Pavilion: 200 guests
- Intimate Lounge: 30 guests
- All halls available for weddings, conferences, and private events

BOOKING & PAYMENTS:
- Book online at the hotel website or through the Guest Portal
- Payments: Monnify (online), Cash, POS at front desk
- Loyalty points: Guests earn points on every booking, redeemable on future stays
- ARIA Concierge (that's you!) is available 24/7 in the Guest Portal

GUEST PORTAL FEATURES (guests can do these themselves without calling):
- Book rooms and pay online
- Order food & drinks to their room, kitchen, bar, or restaurant
- Track order status live (Pending → Confirmed → Preparing → Ready → Delivered)
- Book event halls
- Chat with ENAYI (you) for any questions
- View booking history and loyalty points

Instructions:
- Always respond helpfully, concisely, and warmly
- Use ₦ for Nigerian Naira prices
- For anything you cannot help with, direct the guest to call +234 (0) 913 894 3008 or visit the front desk
- Never make up information you don't have — say you're not sure and offer to connect them with staff
- Keep responses under 200 words unless a detailed answer is genuinely needed"""


# ── Claude model to use ──────────────────────────────────────────
# claude-sonnet-4-6 is Anthropic's latest efficient model — excellent for
# conversational hotel concierge use. Change to claude-opus-4-6 for higher
# quality at higher cost, or claude-haiku-4-5-20251001 for lower cost.
CLAUDE_MODEL = "claude-sonnet-4-6"


def _call_claude(messages_for_claude: list, max_tokens: int = 700) -> tuple[str, int]:
    """
    Call the Anthropic Claude API and return (reply_text, total_tokens).
    Raises if ANTHROPIC_API_KEY is not set or the call fails.

    messages_for_claude should be a list of {"role": "user"|"assistant", "content": str}
    — the system prompt is passed separately via the `system` parameter, which
    is the correct Anthropic API pattern (not prepended as a system message in
    the messages array the way OpenAI does it).
    """
    import anthropic

    api_key = getattr(settings, "ANTHROPIC_API_KEY", "")
    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Go to Render → your backend service → "
            "Environment → Add ANTHROPIC_API_KEY with your key from console.anthropic.com."
        )

    client = anthropic.Anthropic(api_key=api_key)

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=max_tokens,
        system=ENAYI_SYSTEM_PROMPT,
        messages=messages_for_claude,
    )

    reply = response.content[0].text
    total_tokens = response.usage.input_tokens + response.usage.output_tokens
    return reply, total_tokens


class ENAYIConciergeView(APIView):
    """
    POST /api/v1/ai/chat/

    Body:
        { "message": "...", "session_id": "<uuid>" (optional) }

    Response:
        { "reply": "...", "session_id": "<uuid>", "tokens": <int> }

    Keeps a persistent conversation history per session so the guest
    doesn't have to repeat context across messages in the same chat.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        s = ChatInputSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=400)

        message = s.validated_data["message"].strip()
        session_id = s.validated_data.get("session_id")

        # Get or create the chat session
        if session_id:
            try:
                session = ChatSession.objects.get(id=session_id, user=request.user)
            except ChatSession.DoesNotExist:
                session = ChatSession.objects.create(user=request.user)
        else:
            session = ChatSession.objects.create(user=request.user)

        # Save the user's message to history
        ChatMessage.objects.create(session=session, role="user", content=message)

        # Build the conversation history for Claude
        # Claude's messages array must NOT include the system message —
        # that goes in the `system` parameter of client.messages.create().
        history = list(
            session.messages.order_by("created_at").values("role", "content")
        )
        messages_for_claude = [{"role": m["role"], "content": m["content"]} for m in history]

        try:
            reply, tokens = _call_claude(messages_for_claude)

            ChatMessage.objects.create(
                session=session, role="assistant", content=reply, tokens=tokens
            )

            # Set session title from the first message if not yet set
            if session.messages.count() <= 2:
                session.title = message[:80] + ("..." if len(message) > 80 else "")
            session.save(update_fields=["title", "updated_at"])

            return Response({
                "reply":      reply,
                "session_id": str(session.id),
                "tokens":     tokens,
            })

        except Exception as e:
            logger.error(f"ENAYI concierge error: {e}")

            fallback = (
                "I'm sorry — I'm temporarily unable to respond. "
                "Please contact our front desk at +234 (0) 913 894 3008 "
                "or visit reception. We're available 24/7!"
            )
            ChatMessage.objects.create(session=session, role="assistant", content=fallback)

            return Response({
                "reply":      fallback,
                "session_id": str(session.id),
            })


# Keep the old name as an alias so the existing URL conf still works
# without needing a new migration or URL change.
ARIAConciergeView = ENAYIConciergeView


class ChatHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, session_id=None):
        if session_id:
            try:
                session = ChatSession.objects.get(id=session_id, user=request.user)
                return Response({
                    "session_id": str(session.id),
                    "title":      session.title,
                    "messages":   ChatMessageSerializer(
                        session.messages.order_by("created_at"), many=True
                    ).data,
                })
            except ChatSession.DoesNotExist:
                return Response({"error": "Session not found."}, status=404)

        sessions = ChatSession.objects.filter(user=request.user).order_by("-updated_at")[:20]
        return Response(ChatSessionSerializer(sessions, many=True).data)

    def delete(self, request, session_id):
        try:
            session = ChatSession.objects.get(id=session_id, user=request.user)
            session.delete()
            return Response({"message": "Session deleted."})
        except ChatSession.DoesNotExist:
            return Response({"error": "Not found."}, status=404)


class RoomRecommendationView(APIView):
    """
    POST /api/v1/ai/recommend-room/
    Recommends a room type based on guest preferences.
    Open to unauthenticated users (used on the public booking page).
    """
    permission_classes = [AllowAny]

    def post(self, request):
        s = RoomRecommendationInputSerializer(data=request.data)
        if not s.is_valid():
            return Response(s.errors, status=400)

        prefs = s.validated_data
        prompt = f"""A guest wants a room at Enayi Hotels & Suites, Jos Nigeria.

Guest preferences:
- Budget: ₦{prefs.get('budget', 'flexible')}/night
- Guests: {prefs.get('guests', 2)} people
- Nights: {prefs.get('nights', 1)}
- Purpose: {prefs.get('purpose', 'leisure')}
- Special needs: {prefs.get('special_needs', 'none')}

Available rooms:
1. Standard — ₦40,000/night | Queen bed, 28sqm
2. Class Plus — ₦75,000/night | King bed, 42sqm, city view
3. Executive Deluxe — ₦150,000/night | King bed + living room, 68sqm
4. Suite — Premium, contact front desk

Reply ONLY with valid JSON in this exact format:
{{
  "recommended_room": "room name",
  "reason": "one sentence why",
  "alternative": "another room name",
  "estimated_total": <total cost as integer>,
  "tips": ["tip 1", "tip 2"]
}}"""

        try:
            reply, _ = _call_claude(
                [{"role": "user", "content": prompt}],
                max_tokens=300,
            )
            content = reply.strip()
            start = content.find("{")
            end   = content.rfind("}") + 1
            return Response(json.loads(content[start:end]))

        except Exception as e:
            logger.error(f"Room recommendation error: {e}")
            return Response({
                "recommended_room": "Class Plus",
                "reason":           "Our most popular room for most guests.",
                "alternative":      "Executive Deluxe",
                "estimated_total":  75000,
                "tips":             ["Book early for best rates", "Breakfast available on request"],
            })
