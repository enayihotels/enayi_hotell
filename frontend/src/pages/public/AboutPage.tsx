import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Link } from 'react-router-dom'
import {
  Heart, Star, Award, MapPin, Clock, Phone, Mail,
  Users, Shield, Leaf, Globe, ChevronRight, Quote
} from 'lucide-react'

const fadeUp = {
  hidden:  { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
}

const stagger = { visible: { transition: { staggerChildren: 0.15 } } }

function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const [ref, inView] = useInView({ threshold: 0.08, triggerOnce: true })
  return (
    <motion.div ref={ref} variants={stagger} initial="hidden" animate={inView ? 'visible' : 'hidden'} className={className}>
      {children}
    </motion.div>
  )
}

const TEAM = [
  { name: 'Engr. Emmanuel Enayi', role: 'Founder & Chairman', bio: 'A visionary entrepreneur with 25 years in Nigerian hospitality, who built Enayi Hotels from a dream into Plateau State\'s finest luxury destination.', initial: 'E' },
  { name: 'Mrs. Grace Enayi',     role: 'Managing Director',   bio: 'Combining warmth and world-class management expertise, Grace ensures every guest\'s experience exceeds all expectations.', initial: 'G' },
  { name: 'Mr. David Pam',        role: 'Executive Chef',       bio: 'A culinary master trained in Lagos, London, and Accra — David crafts extraordinary Nigerian and continental dining experiences.', initial: 'D' },
  { name: 'Ms. Sarah Jatau',      role: 'Head of Events',       bio: 'Jos\'s most celebrated event coordinator, Sarah turns every occasion at Enayi Hotels into a cherished memory.', initial: 'S' },
]

const VALUES = [
  { icon: Heart,  title: 'Heartfelt Hospitality', desc: 'We don\'t just welcome guests — we welcome family. Every interaction is infused with the warmth and generosity that defines the Nigerian spirit.' },
  { icon: Star,   title: 'Uncompromising Excellence', desc: 'From the thread count on our linens to the garnish on your plate, we obsess over every detail so you never have to.' },
  { icon: Shield, title: 'Trust & Integrity', desc: 'Your comfort, safety, and privacy are sacred to us. We operate with complete transparency and honesty in everything we do.' },
  { icon: Leaf,   title: 'Sustainable Luxury', desc: 'We celebrate the beauty of Plateau State responsibly — using local produce, reducing waste, and giving back to our Jos community.' },
  { icon: Globe,  title: 'World-Class Standards', desc: 'International hospitality benchmarks meet authentic Nigerian warmth — giving you the best of both worlds in the heart of Jos.' },
  { icon: Users,  title: 'Community First', desc: 'We are proudly Plateau-born. Over 85% of our team are Jos indigenes, and we actively support local suppliers, artisans, and entrepreneurs.' },
]

const MILESTONES = [
  { year: '2009', title: 'A Vision Is Born',        desc: 'Engr. Emmanuel Enayi breaks ground on Rayfield Road with a bold dream: to bring world-class luxury to the Plateau capital.' },
  { year: '2012', title: 'Grand Opening',            desc: 'Enayi Hotels & Suites opens its doors with 40 rooms, the Royal Banquet Hall, and a restaurant that immediately becomes Jos\'s finest.' },
  { year: '2015', title: 'Award-Winning Kitchen',   desc: 'Our Executive Chef wins the "Best Hotel Restaurant in North-Central Nigeria" award — the first of many national recognitions.' },
  { year: '2018', title: 'Expansion & Renewal',     desc: 'A ₦500M renovation adds 80 new premium rooms, the Executive Conference Centre, and our iconic rooftop bar.' },
  { year: '2021', title: 'Digital Transformation',  desc: 'Launch of online booking, AI-powered guest services, and our award-winning mobile experience — hospitality redefined.' },
  { year: '2024', title: 'Leading the Future',       desc: 'Enayi Hotels is recognised as Plateau State\'s #1 luxury hotel, with over 50,000 happy guests and a growing national reputation.' },
]

const AWARDS = [
  { title: 'Best Luxury Hotel', body: 'North-Central Nigeria Tourism Awards 2023' },
  { title: 'Excellence in Hospitality', body: 'Nigerian Hotel & Tourism Federation 2022' },
  { title: 'Best Wedding Venue', body: 'Plateau State Events Excellence Awards 2023' },
  { title: 'Sustainable Hotel of the Year', body: 'Green Hospitality Nigeria Initiative 2022' },
]

export default function AboutPage() {
  return (
    <div className="overflow-x-hidden">

      {/* ═══════════════════════════════════════
          HERO
          ═══════════════════════════════════════ */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-enayi-panel via-enayi-surface to-enayi-bg" />
        <div className="absolute inset-0 bg-grid opacity-25" />
        <div className="glow-orb w-[500px] h-[500px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-25" />

        <div className="relative z-10 container-site text-center py-24">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="badge-gold inline-flex mb-5">✦ Our Story</div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1 }}
            className="font-display text-display-lg text-enayi-text leading-tight mb-6 text-balance"
          >
            More Than a Hotel.<br />
            <span className="text-gold">A Home Away From Home.</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="gold-line-center mb-8"
          />

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="text-enayi-muted text-xl max-w-2xl mx-auto leading-relaxed"
          >
            Nestled on the scenic Rayfield Road in the cool highlands of Jos, Plateau State —
            Enayi Hotels & Suites has been the definitive address for luxury, comfort,
            and unforgettable Nigerian hospitality since 2012.
          </motion.p>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          WELCOME MESSAGE
          ═══════════════════════════════════════ */}
      <section className="section bg-enayi-surface border-y border-enayi-border">
        <div className="container-site">
          <div className="max-w-4xl mx-auto">
            <Section>
              <motion.div variants={fadeUp} className="flex justify-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-enayi-gold/10 border border-enayi-gold/30 flex items-center justify-center">
                  <Quote size={28} className="text-enayi-gold" />
                </div>
              </motion.div>

              <motion.h2 variants={fadeUp}
                className="font-display text-3xl md:text-4xl text-enayi-text text-center mb-8 leading-snug">
                A Warm Welcome from <span className="text-gold">Enayi Hotels & Suites</span>
              </motion.h2>

              <motion.div variants={fadeUp} className="prose prose-lg max-w-none">
                <p className="text-enayi-text text-lg leading-relaxed text-center mb-6">
                  <em className="text-enayi-gold not-italic font-heading text-xl">
                    "Sannu da zuwa — Welcome."
                  </em>
                </p>

                <p className="text-enayi-muted text-base leading-loose mb-5">
                  Whether you have arrived from Lagos, Abuja, or the far corners of the world — you have
                  found your sanctuary. At Enayi Hotels & Suites, we believe that every journey deserves
                  a destination that restores the soul. Here, on the cool, refreshing plateau of Jos,
                  we have built exactly that.
                </p>

                <p className="text-enayi-muted text-base leading-loose mb-5">
                  Our story began with a simple but profound conviction: that Nigeria deserves a hotel
                  experience that reflects the richness of our culture, the warmth of our people, and the
                  excellence the world has come to expect. From the moment you step through our doors,
                  you will feel it — in the attentive smile of our front desk team, in the aroma drifting
                  from our kitchen, in the crisp, cool highland air that fills your room.
                </p>

                <p className="text-enayi-muted text-base leading-loose mb-5">
                  Jos is a city unlike any other in Nigeria. Known as the "Home of Peace and Tourism,"
                  it boasts a climate that visitors from the south describe as magical — refreshingly cool
                  evenings, bright mornings, and a pace of life that invites you to breathe deeply and
                  savour every moment. Enayi Hotels & Suites sits proudly on Rayfield Road,
                  in one of the most beautiful and serene parts of this extraordinary city.
                </p>

                <p className="text-enayi-muted text-base leading-loose mb-5">
                  From our sumptuous Presidential Suites to our thoughtfully appointed Standard Rooms,
                  from the flavours of our award-winning restaurant to the excitement of our fully
                  equipped event halls — every inch of Enayi Hotels has been designed with one
                  person in mind: <strong className="text-enayi-text">you</strong>.
                </p>

                <p className="text-enayi-text font-heading text-lg leading-relaxed italic text-center mt-8">
                  "We are not just in the business of renting rooms. We are in the business of
                  creating memories that last a lifetime. And we are honoured that you have chosen
                  to make your memory here with us."
                </p>

                <p className="text-center text-enayi-gold font-semibold mt-4">
                  — Engr. Emmanuel Enayi, Founder
                </p>
              </motion.div>
            </Section>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          STATS
          ═══════════════════════════════════════ */}
      <section className="section-sm">
        <div className="container-site">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '200+', label: 'Luxury Rooms & Suites',     icon: '🛏️' },
              { value: '50k+', label: 'Happy Guests Hosted',        icon: '😊' },
              { value: '12+',  label: 'Years of Excellence',        icon: '🏆' },
              { value: '4.9★', label: 'Average Guest Rating',       icon: '⭐' },
            ].map((stat, i) => (
              <motion.div key={stat.label}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="card-gold p-6 text-center rounded-2xl"
              >
                <div className="text-3xl mb-2">{stat.icon}</div>
                <div className="font-display text-3xl text-gold mb-1">{stat.value}</div>
                <div className="text-enayi-muted text-sm">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          OUR VALUES
          ═══════════════════════════════════════ */}
      <section className="section bg-enayi-surface border-y border-enayi-border">
        <div className="container-site">
          <Section className="text-center mb-14">
            <motion.div variants={fadeUp} className="badge-gold inline-flex mb-4">✦ What We Stand For</motion.div>
            <motion.h2 variants={fadeUp} className="font-display text-display-md text-enayi-text mb-4">
              Our Values & Promise to You
            </motion.h2>
            <motion.div variants={fadeUp} className="gold-line-center mb-5" />
            <motion.p variants={fadeUp} className="text-enayi-muted text-lg max-w-xl mx-auto">
              Six principles that guide every decision, every interaction, every experience at Enayi Hotels & Suites.
            </motion.p>
          </Section>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {VALUES.map((v, i) => (
              <motion.div key={v.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="card p-6 group hover:border-enayi-gold/25 hover:shadow-gold-glow transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-enayi-gold/10 border border-enayi-gold/20 flex items-center justify-center mb-4 group-hover:bg-enayi-gold/15">
                  <v.icon size={20} className="text-enayi-gold" />
                </div>
                <h3 className="font-heading text-lg text-enayi-text mb-2">{v.title}</h3>
                <p className="text-enayi-muted text-sm leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          HISTORY / MILESTONES
          ═══════════════════════════════════════ */}
      <section className="section">
        <div className="container-site">
          <Section className="text-center mb-14">
            <motion.div variants={fadeUp} className="badge-gold inline-flex mb-4">✦ Our Journey</motion.div>
            <motion.h2 variants={fadeUp} className="font-display text-display-md text-enayi-text mb-4">
              Fifteen Years of Building Dreams
            </motion.h2>
            <motion.div variants={fadeUp} className="gold-line-center" />
          </Section>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-enayi-gold via-enayi-gold/30 to-transparent" />

            <div className="space-y-10">
              {MILESTONES.map((m, i) => (
                <motion.div key={m.year}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.1 }}
                  className={`flex gap-8 md:gap-0 items-start ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}
                >
                  <div className="md:w-1/2 pl-16 md:pl-0 md:pr-12 flex justify-end">
                    {i % 2 === 0 ? (
                      <div className="card p-5 max-w-sm w-full">
                        <div className="text-enayi-gold font-display text-2xl mb-1">{m.year}</div>
                        <div className="text-enayi-text font-heading text-lg mb-2">{m.title}</div>
                        <p className="text-enayi-muted text-sm leading-relaxed">{m.desc}</p>
                      </div>
                    ) : <div className="hidden md:block" />}
                  </div>

                  {/* Dot */}
                  <div className="absolute left-8 md:left-1/2 md:-translate-x-1/2 w-4 h-4 rounded-full bg-enayi-gold border-2 border-enayi-bg shadow-gold mt-1" />

                  <div className="md:w-1/2 md:pl-12">
                    {i % 2 !== 0 ? (
                      <div className="card p-5 max-w-sm w-full">
                        <div className="text-enayi-gold font-display text-2xl mb-1">{m.year}</div>
                        <div className="text-enayi-text font-heading text-lg mb-2">{m.title}</div>
                        <p className="text-enayi-muted text-sm leading-relaxed">{m.desc}</p>
                      </div>
                    ) : <div className="hidden md:block" />}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          LEADERSHIP TEAM
          ═══════════════════════════════════════ */}
      <section className="section bg-enayi-surface border-y border-enayi-border">
        <div className="container-site">
          <Section className="text-center mb-14">
            <motion.div variants={fadeUp} className="badge-gold inline-flex mb-4"><Users size={12} /> Meet the Team</motion.div>
            <motion.h2 variants={fadeUp} className="font-display text-display-md text-enayi-text mb-4">
              The People Behind the Magic
            </motion.h2>
            <motion.div variants={fadeUp} className="gold-line-center mb-5" />
            <motion.p variants={fadeUp} className="text-enayi-muted text-lg max-w-xl mx-auto">
              Our leadership team brings decades of Nigerian and international hospitality experience to every decision.
            </motion.p>
          </Section>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TEAM.map((member, i) => (
              <motion.div key={member.name}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="card p-6 text-center group hover:border-enayi-gold/25 transition-all"
              >
                <div className="w-20 h-20 rounded-full bg-enayi-gold/10 border-2 border-enayi-gold/30 flex items-center justify-center mx-auto mb-4 group-hover:border-enayi-gold/60 transition-colors">
                  <span className="text-enayi-gold font-display text-3xl">{member.initial}</span>
                </div>
                <h3 className="font-heading text-lg text-enayi-text mb-1">{member.name}</h3>
                <div className="text-enayi-gold text-xs font-semibold uppercase tracking-wider mb-3">{member.role}</div>
                <p className="text-enayi-muted text-sm leading-relaxed">{member.bio}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          AWARDS
          ═══════════════════════════════════════ */}
      <section className="section">
        <div className="container-site">
          <Section className="text-center mb-12">
            <motion.div variants={fadeUp} className="badge-gold inline-flex mb-4"><Award size={12} /> Recognition</motion.div>
            <motion.h2 variants={fadeUp} className="font-display text-display-md text-enayi-text mb-4">
              Awards & Accolades
            </motion.h2>
            <motion.div variants={fadeUp} className="gold-line-center" />
          </Section>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {AWARDS.map((a, i) => (
              <motion.div key={a.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="card-gold p-5 text-center rounded-2xl"
              >
                <Award size={28} className="text-enayi-gold mx-auto mb-3" />
                <div className="text-enayi-text font-semibold text-sm mb-1">{a.title}</div>
                <div className="text-enayi-muted text-xs">{a.body}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          LOCATION
          ═══════════════════════════════════════ */}
      <section className="section bg-enayi-surface border-t border-enayi-border">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <Section>
              <motion.div variants={fadeUp} className="badge-gold inline-flex mb-4"><MapPin size={12} /> Find Us</motion.div>
              <motion.h2 variants={fadeUp} className="font-display text-display-sm text-enayi-text mb-4">
                In the Heart of<br /><span className="text-gold">Beautiful Jos</span>
              </motion.h2>
              <motion.div variants={fadeUp} className="gold-line mb-6" />
              <motion.p variants={fadeUp} className="text-enayi-muted text-base leading-relaxed mb-8">
                Jos is nicknamed "The Home of Peace and Tourism" for good reason — its cool highland climate,
                stunning landscapes, and friendly people make it one of Nigeria's most beloved destinations.
                We sit proudly on Rayfield Road, just 15 minutes from Jos International Airport,
                close to the Plateau Museum, Shere Hills, and the famous Rayfield Resort.
              </motion.p>
              <motion.div variants={fadeUp} className="space-y-4">
                {[
                  { icon: MapPin, label: 'Address',  value: 'Rayfield Road, Jos, Plateau State, Nigeria' },
                  { icon: Phone,  label: 'Phone',    value: '+234-800-000-0000' },
                  { icon: Mail,   label: 'Email',    value: 'info@enayihotels.com' },
                  { icon: Clock,  label: 'Hours',    value: 'Front Desk: 24 hours, 7 days a week' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-lg bg-enayi-gold/10 border border-enayi-gold/20 flex items-center justify-center flex-shrink-0">
                      <Icon size={16} className="text-enayi-gold" />
                    </div>
                    <div>
                      <div className="text-enayi-gold text-xs font-semibold uppercase tracking-wider">{label}</div>
                      <div className="text-enayi-text text-sm mt-0.5">{value}</div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </Section>
            <div className="aspect-square rounded-3xl bg-enayi-panel border border-enayi-border flex items-center justify-center">
              <div className="text-center">
                <MapPin size={48} className="text-enayi-gold/40 mx-auto mb-3" />
                <p className="text-enayi-muted text-sm">Rayfield Road, Jos</p>
                <p className="text-enayi-gold text-xs mt-1">9.8965°N, 8.8583°E</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          CTA
          ═══════════════════════════════════════ */}
      <section className="section-sm">
        <div className="container-site text-center">
          <div className="card-gold rounded-3xl p-10 md:p-16 relative overflow-hidden">
            <div className="glow-orb w-80 h-80 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20" />
            <div className="relative z-10">
              <h2 className="font-display text-3xl md:text-4xl text-enayi-text mb-4">
                Ready to Experience<br />
                <span className="text-gold">Enayi Hotels & Suites?</span>
              </h2>
              <p className="text-enayi-muted text-lg mb-8 max-w-md mx-auto">
                Join over 50,000 guests who have discovered the finest hospitality in Plateau State.
                Your extraordinary stay begins with a single click.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/book" className="btn-gold-lg gap-2">
                  Book Your Stay <ChevronRight size={18} />
                </Link>
                <Link to="/contact" className="btn-outline gap-2">
                  <Phone size={15} /> Contact Us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
