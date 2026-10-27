import { Document, Page, Text, View, Image, Svg, Path, Circle, G, Font, StyleSheet } from '@react-pdf/renderer'
import { amountInWords, formatDate, quotationName } from '../lib/format'
import logoBlack from '../images/logo-black.png'
import notoRegular from '../fonts/NotoSans-Regular.ttf'
import notoBold from '../fonts/NotoSans-Bold.ttf'

// Noto Sans carries the rupee glyph that the built-in PDF fonts lack.
Font.register({
  family: 'NotoSans',
  fonts: [
    { src: notoRegular, fontWeight: 400 },
    { src: notoBold, fontWeight: 700 },
  ],
})

const BROWN = '#8a5a2b'
const GOLD = '#c9a36b'
const CREAM = '#f7f1ea'
const SOFT = '#fbf8f4'
const DARK = '#2f2218'
const INK = '#1f2937'
const TEXT = '#374151'
const MUTED = '#6b7280'
const WARM_BORDER = '#e5d8c6'

const PAYMENT_LABELS = { Advance: 'Advance Received', 'Part Payment': 'Received', 'Final Payment': 'Final Payment Received' }

const rs = (n) => `\u20b9 ${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}/-`
const dashDate = (d) => (d ? formatDate(d).replace(/ /g, '-') : '-')
const lines = (text) => (text || '').split('\n').map((l) => l.trim()).filter(Boolean)

const S = StyleSheet.create({
  // Cover
  cover: { backgroundColor: CREAM, fontFamily: 'NotoSans', padding: 0 },
  frame: { position: 'absolute', top: 20, left: 20, right: 20, bottom: 20, borderWidth: 0.8, borderColor: GOLD },
  coverBody: { flex: 1, paddingTop: 64, paddingBottom: 200, paddingHorizontal: 60, alignItems: 'center' },
  logo: { width: 390, height: 137 },
  ornamentRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginVertical: 10 },
  ornamentLine: { flex: 1, height: 0.8, backgroundColor: GOLD },
  ornamentDiamond: { width: 7, height: 7, backgroundColor: GOLD, marginHorizontal: 8, transform: 'rotate(45deg)' },
  coverTitle: { fontFamily: 'Times-Roman', fontSize: 60, color: BROWN, letterSpacing: 3, marginTop: 46 },
  forRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginTop: 2 },
  forText: { fontFamily: 'Times-Roman', fontSize: 15, color: INK, marginHorizontal: 12, letterSpacing: 2 },
  coverSubtitle: { fontFamily: 'Times-Roman', fontSize: 26, color: INK, textAlign: 'center', marginTop: 8 },
  coverRef: { fontSize: 8, color: MUTED, letterSpacing: 1.5, marginTop: 14, textAlign: 'center' },

  band: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: DARK, paddingTop: 24, paddingBottom: 26, paddingHorizontal: 50 },
  tagline: { fontSize: 8, color: GOLD, letterSpacing: 3, textAlign: 'center', marginBottom: 16 },
  contactRow: { flexDirection: 'row' },
  contactCol: { flex: 1, paddingHorizontal: 14 },
  contactDivider: { width: 0.8, backgroundColor: BROWN },
  contactHeading: { fontSize: 8.5, fontWeight: 700, color: GOLD, letterSpacing: 1.5, marginBottom: 8 },
  contactLabel: { fontSize: 7.5, color: '#bfa985', letterSpacing: 1 },
  contactValue: { fontSize: 9.5, color: '#f3e9da', marginBottom: 7, lineHeight: 1.4 },
  coverThanks: { fontSize: 8, color: '#bfa985', marginTop: 10, textAlign: 'center' },

  // Content pages
  page: { fontFamily: 'NotoSans', fontSize: 10, color: TEXT, paddingTop: 58, paddingBottom: 56, paddingHorizontal: 40 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 8, backgroundColor: BROWN },
  header: { position: 'absolute', top: 22, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 0.8, borderColor: WARM_BORDER, paddingBottom: 6 },
  headerBrand: { fontSize: 8.5, fontWeight: 700, color: BROWN, letterSpacing: 1 },
  headerText: { fontSize: 8.5, color: MUTED, letterSpacing: 0.5 },
  footer: { position: 'absolute', bottom: 22, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.8, borderColor: WARM_BORDER, paddingTop: 6 },
  footerText: { fontSize: 8, color: MUTED },

  section: { marginBottom: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  accent: { width: 4, height: 13, backgroundColor: GOLD, borderRadius: 2, marginRight: 8 },
  heading: { fontSize: 9.5, fontWeight: 700, color: BROWN, letterSpacing: 1.5 },
  headLine: { flex: 1, height: 0.8, backgroundColor: WARM_BORDER, marginLeft: 10 },

  infoCard: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: SOFT, borderWidth: 0.8, borderColor: WARM_BORDER, borderRadius: 6, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 4 },
  infoCell: { width: '50%', marginBottom: 10, paddingRight: 10 },
  infoCellFull: { width: '100%', marginBottom: 10 },
  infoLabel: { fontSize: 7.5, color: MUTED, letterSpacing: 1, marginBottom: 2 },
  infoValue: { fontSize: 10.5, fontWeight: 700, color: INK, lineHeight: 1.35 },

  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { fontSize: 9.5, color: BROWN, backgroundColor: CREAM, borderWidth: 0.8, borderColor: GOLD, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 11, marginRight: 6, marginBottom: 6 },

  listRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  listDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD, marginTop: 4, marginRight: 9 },
  listText: { flex: 1, lineHeight: 1.4 },
  numCircle: { width: 15, height: 15, borderRadius: 7.5, backgroundColor: CREAM, borderWidth: 0.8, borderColor: GOLD, alignItems: 'center', justifyContent: 'center', marginRight: 9, marginTop: 0.5 },
  numText: { fontSize: 7.5, fontWeight: 700, color: BROWN },

  table: { borderWidth: 0.8, borderColor: WARM_BORDER, borderRadius: 5 },
  thRow: { flexDirection: 'row', backgroundColor: BROWN, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  th: { fontSize: 7.5, fontWeight: 700, color: '#ffffff', letterSpacing: 1, paddingVertical: 7, paddingHorizontal: 8 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.8, borderColor: WARM_BORDER },
  td: { paddingVertical: 7, paddingHorizontal: 8, lineHeight: 1.35 },

  totalCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK, borderRadius: 8, borderLeftWidth: 5, borderColor: GOLD, paddingVertical: 16, paddingHorizontal: 18 },
  totalLabel: { fontSize: 8, color: GOLD, letterSpacing: 2, fontWeight: 700 },
  totalWords: { fontSize: 8.5, color: '#d9c7aa', marginTop: 4, lineHeight: 1.4 },
  totalAmount: { fontSize: 21, fontWeight: 700, color: '#f4dfae' },

  stats: { flexDirection: 'row', marginTop: 12 },
  stat: { flex: 1, borderWidth: 0.8, borderColor: WARM_BORDER, borderRadius: 6, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#ffffff' },
  statHighlight: { backgroundColor: CREAM, borderColor: GOLD },
  statLabel: { fontSize: 7.5, color: MUTED, letterSpacing: 1, marginBottom: 4 },
  statValue: { fontSize: 13, fontWeight: 700, color: INK },

  thanks: { backgroundColor: CREAM, borderWidth: 0.8, borderColor: GOLD, borderRadius: 8, paddingVertical: 18, paddingHorizontal: 24, alignItems: 'center' },
  thanksTitle: { fontFamily: 'Times-Roman', fontSize: 20, color: BROWN, marginBottom: 6 },
  thanksLine: { fontWeight: 700, color: INK, marginBottom: 4, textAlign: 'center' },
  thanksText: { lineHeight: 1.5, textAlign: 'center', color: TEXT },
})

// Floral artwork drawn from plain SVG paths so it needs no image files.
const rad = (d) => (d * Math.PI) / 180
const fmt = (n) => n.toFixed(2)
const polar = (x, y, deg, len) => [x + Math.cos(rad(deg)) * len, y + Math.sin(rad(deg)) * len]

// Teardrop used for both petals and leaves, growing from (x, y) toward `deg`.
function teardrop(x, y, deg, len, width) {
  const [tx, ty] = polar(x, y, deg, len)
  const [mx, my] = polar(x, y, deg, len * 0.5)
  const [ax, ay] = polar(mx, my, deg + 90, width)
  const [bx, by] = polar(mx, my, deg - 90, width)
  return `M${fmt(x)} ${fmt(y)} Q${fmt(ax)} ${fmt(ay)} ${fmt(tx)} ${fmt(ty)} Q${fmt(bx)} ${fmt(by)} ${fmt(x)} ${fmt(y)} Z`
}

function Flower({ x, y, r, petals = 8 }) {
  const step = 360 / petals
  return (
    <G>
      {Array.from({ length: petals }, (_, i) => (
        <Path key={`o${i}`} d={teardrop(x, y, step * i, r, r * 0.95)} fill="#efdcb9" stroke={GOLD} strokeWidth={0.5} />
      ))}
      {Array.from({ length: petals }, (_, i) => (
        <Path key={`i${i}`} d={teardrop(x, y, step * i + step / 2, r * 0.62, r * 0.6)} fill="#e0bf88" stroke={GOLD} strokeWidth={0.4} />
      ))}
      <Circle cx={x} cy={y} r={r * 0.2} fill={BROWN} />
    </G>
  )
}

// Curved stem (quadratic Bezier p0 -> p2 via c) with leaves alternating along it.
function Branch({ p0, c, p2, leaves = 6, leafLen = 14 }) {
  const at = (t) => [
    (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t ** 2 * p2[0],
    (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t ** 2 * p2[1],
  ]
  const heading = (t) =>
    (Math.atan2(
      2 * (1 - t) * (c[1] - p0[1]) + 2 * t * (p2[1] - c[1]),
      2 * (1 - t) * (c[0] - p0[0]) + 2 * t * (p2[0] - c[0])
    ) *
      180) /
    Math.PI
  return (
    <G>
      <Path d={`M${p0[0]} ${p0[1]} Q${c[0]} ${c[1]} ${p2[0]} ${p2[1]}`} fill="none" stroke={GOLD} strokeWidth={1} />
      {Array.from({ length: leaves }, (_, i) => {
        const t = (i + 1) / (leaves + 1)
        const [x, y] = at(t)
        const side = i % 2 === 0 ? 1 : -1
        const len = leafLen * (0.65 + 0.35 * Math.sin(Math.PI * t))
        return (
          <Path
            key={i}
            d={teardrop(x, y, heading(t) + side * 52, len, len * 0.55)}
            fill="#b9935a"
            fillOpacity={0.4}
            stroke={GOLD}
            strokeWidth={0.5}
          />
        )
      })}
    </G>
  )
}

// Spray of flowers for a page corner; `flip` mirrors it to the right-hand side.
function CornerSprig({ flip = false }) {
  const size = 120
  const X = (x) => (flip ? size - x : x)
  const P = ([x, y]) => [X(x), y]
  return (
    <Svg width={100} height={100} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute', top: 20, [flip ? 'right' : 'left']: 20 }}>
      <Branch p0={P([6, 6])} c={P([90, 8])} p2={P([112, 84])} leaves={5} />
      <Branch p0={P([6, 6])} c={P([8, 90])} p2={P([84, 112])} leaves={5} />
      <Flower x={X(51)} y={14} r={10} />
      <Flower x={X(14)} y={51} r={10} />
      <Flower x={X(112)} y={84} r={6.5} petals={6} />
      <Flower x={X(84)} y={112} r={6.5} petals={6} />
      <Flower x={X(15)} y={15} r={19} petals={10} />
    </Svg>
  )
}

// Horizontal garland that sits between the title block and the contact band.
function FloralGarland() {
  return (
    <Svg width={340} height={84} viewBox="0 0 340 84">
      <Branch p0={[170, 46]} c={[110, 72]} p2={[22, 40]} leaves={7} leafLen={16} />
      <Branch p0={[170, 46]} c={[230, 72]} p2={[318, 40]} leaves={7} leafLen={16} />
      <Flower x={102} y={57} r={11} petals={7} />
      <Flower x={238} y={57} r={11} petals={7} />
      <Flower x={22} y={40} r={7} petals={6} />
      <Flower x={318} y={40} r={7} petals={6} />
      <Circle cx={60} cy={52} r={2.2} fill={GOLD} />
      <Circle cx={280} cy={52} r={2.2} fill={GOLD} />
      <Flower x={170} y={40} r={22} petals={10} />
    </Svg>
  )
}

function Section({ title, children }) {
  return (
    <View style={S.section}>
      <View style={S.sectionHead} minPresenceAhead={60}>
        <View style={S.accent} />
        <Text style={S.heading}>{title.toUpperCase()}</Text>
        <View style={S.headLine} />
      </View>
      {children}
    </View>
  )
}

function Chips({ items }) {
  return (
    <View style={S.chips}>
      {items.map((text, i) => (
        <Text key={i} style={S.chip}>
          {text}
        </Text>
      ))}
    </View>
  )
}

function Checklist({ items }) {
  return items.map((text, i) => (
    <View key={i} style={S.listRow} wrap={false}>
      <View style={S.listDot} />
      <Text style={S.listText}>{text}</Text>
    </View>
  ))
}

function Numbered({ items }) {
  return items.map((text, i) => (
    <View key={i} style={S.listRow} wrap={false}>
      <View style={S.numCircle}>
        <Text style={S.numText}>{i + 1}</Text>
      </View>
      <Text style={S.listText}>{text}</Text>
    </View>
  ))
}

// columns: [{ label, flex, align }]; rows: arrays of strings.
function Table({ columns, rows }) {
  const cell = (base, i) => [base, { flex: columns[i].flex || 1, textAlign: columns[i].align || 'left' }]
  return (
    <View style={S.table}>
      <View style={S.thRow} wrap={false}>
        {columns.map((c, i) => (
          <Text key={c.label} style={cell(S.th, i)}>
            {c.label.toUpperCase()}
          </Text>
        ))}
      </View>
      {rows.map((row, r) => {
        const isLast = r === rows.length - 1
        return (
          <View
            key={r}
            style={[
              S.tr,
              r % 2 === 1 ? { backgroundColor: SOFT } : {},
              isLast ? { borderBottomWidth: 0, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 } : {},
            ]}
            wrap={false}
          >
            {row.map((value, i) => (
              <Text key={i} style={cell(S.td, i)}>
                {value || '-'}
              </Text>
            ))}
          </View>
        )
      })}
    </View>
  )
}

function ContactLines({ text }) {
  return String(text || '')
    .split(/\n+/)
    .filter(Boolean)
    .map((line, i) => (
      <Text key={i} style={S.contactValue}>
        {line}
      </Text>
    ))
}

export default function QuotationPDF({ profile = {}, quotation = {}, client = {} }) {
  const details = quotation.details || {}
  const items = quotation.items || []
  const services = items.map((it) => it.description).filter(Boolean)
  const deliverables = details.deliverables || []
  const schedule = details.schedule || []
  const payments = details.payments || []
  const terms = lines(quotation.notes)

  const subtotal = Number(quotation.subtotal) || 0
  const discount = Number(quotation.discount) || 0
  const total = Number(quotation.total) || 0
  const received = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const balance = Math.max(0, total - received)

  const coverTitle = (details.package_title || `${quotation.event_type || 'Event'} Photography`).toUpperCase()
  const studio = profile.studio_name || 'Abhishek Kodgire Photography & Films'
  const phone = details.phone || client.phone
  const address = details.billing_address || client.address

  const customerFields = [
    ['CUSTOMER NAME', client.name || '-'],
    ['CONTACT NO.', phone],
    ['EVENT', quotation.event_type],
    ['EVENT DATE', quotation.event_date ? formatDate(quotation.event_date) : ''],
  ].filter(([, value]) => value)

  return (
    <Document title={quotationName(quotation, client)}>
      {/* Cover */}
      <Page size="A4" style={S.cover}>
        <View style={S.frame} />
        <CornerSprig />
        <CornerSprig flip />
        <View style={S.coverBody}>
          <Image src={logoBlack} style={S.logo} />
          <View style={S.ornamentRow}>
            <View style={S.ornamentLine} />
            <View style={S.ornamentDiamond} />
            <View style={S.ornamentLine} />
          </View>

          <Text style={S.coverTitle}>QUOTATION</Text>
          <View style={S.forRow}>
            <View style={S.ornamentLine} />
            <Text style={S.forText}>FOR</Text>
            <View style={S.ornamentLine} />
          </View>
          <Text style={S.coverSubtitle}>{coverTitle}</Text>
          <View style={S.ornamentRow}>
            <View style={S.ornamentLine} />
            <View style={S.ornamentDiamond} />
            <View style={S.ornamentLine} />
          </View>

          <View style={{ marginTop: 28 }}>
            <FloralGarland />
          </View>
          <Text style={S.coverRef}>{dashDate(quotation.issue_date)}</Text>
        </View>

        <View style={S.band}>
          <Text style={S.tagline}>CAPTURING MOMENTS.  CREATING MEMORIES.</Text>
          <View style={S.contactRow}>
            <View style={S.contactCol}>
              <Text style={S.contactHeading}>GET IN TOUCH</Text>
              {profile.phone ? (
                <>
                  <Text style={S.contactLabel}>MOBILE</Text>
                  <ContactLines text={profile.phone} />
                </>
              ) : null}
              {profile.email ? (
                <>
                  <Text style={S.contactLabel}>EMAIL</Text>
                  <Text style={S.contactValue}>{profile.email}</Text>
                </>
              ) : null}
            </View>
            <View style={S.contactDivider} />
            <View style={S.contactCol}>
              <Text style={S.contactHeading}>ADDRESS</Text>
              <Text style={S.contactValue}>{profile.address || '-'}</Text>
            </View>
          </View>
          <Text style={S.coverThanks}>Thank you for considering us to capture your special moments.</Text>
        </View>
      </Page>

      {/* Details */}
      <Page size="A4" style={S.page}>
        <View style={S.topBar} fixed />
        <View style={S.header} fixed>
          <Text style={S.headerBrand}>{studio.toUpperCase()}</Text>
          <Text style={S.headerText}>QUOTATION</Text>
        </View>
        <View style={S.footer} fixed>
          <Text style={S.footerText}>Capturing moments. Creating memories.</Text>
          <Text
            style={S.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber - 1} of ${totalPages - 1}`}
          />
        </View>

        <Section title="Customer Details">
          <View style={S.infoCard}>
            {customerFields.map(([label, value]) => (
              <View key={label} style={S.infoCell}>
                <Text style={S.infoLabel}>{label}</Text>
                <Text style={S.infoValue}>{value}</Text>
              </View>
            ))}
            {address ? (
              <View style={S.infoCellFull}>
                <Text style={S.infoLabel}>ADDRESS</Text>
                <Text style={S.infoValue}>{address}</Text>
              </View>
            ) : null}
          </View>
        </Section>

        {services.length > 0 && (
          <Section title="Services Included">
            <Chips items={services} />
          </Section>
        )}

        {deliverables.length > 0 && (
          <Section title="Deliverables">
            <Checklist items={deliverables} />
          </Section>
        )}

        {schedule.length > 0 && (
          <Section title="Event Schedule">
            <Table
              columns={[
                { label: 'Date', flex: 1 },
                { label: 'Event', flex: 1.2 },
                { label: 'Coverage', flex: 1.6 },
                { label: 'Location', flex: 1.4 },
              ]}
              rows={schedule.map((r) => [r.date ? formatDate(r.date) : '', r.event, r.coverage, r.location])}
            />
          </Section>
        )}

        <Section title="Total Package Amount">
          <View style={S.totalCard} wrap={false}>
            <View style={{ flex: 1, paddingRight: 14 }}>
              <Text style={S.totalLabel}>TOTAL PACKAGE AMOUNT</Text>
              {discount > 0 ? (
                <Text style={S.totalWords}>
                  {`Sub Total ${rs(subtotal)}  \u00b7  Discount ${rs(discount)}`}
                </Text>
              ) : null}
              <Text style={S.totalWords}>{amountInWords(total)}</Text>
            </View>
            <Text style={S.totalAmount}>{rs(total)}</Text>
          </View>
        </Section>

        {payments.length > 0 && (
          <Section title="Payment Details">
            <Table
              columns={[
                { label: 'Date', flex: 1 },
                { label: 'Mode', flex: 1.6 },
                { label: 'Amount', flex: 1, align: 'right' },
              ]}
              rows={payments.map((p) => {
                const label = PAYMENT_LABELS[p.type || (p.advance ? 'Advance' : '')]
                return [dashDate(p.date), label ? `${p.mode} (${label})` : p.mode, rs(p.amount)]
              })}
            />
            <View style={S.stats} wrap={false}>
              <View style={[S.stat, { marginRight: 8 }]}>
                <Text style={S.statLabel}>TOTAL AMOUNT</Text>
                <Text style={S.statValue}>{rs(total)}</Text>
              </View>
              <View style={[S.stat, { marginRight: 8 }]}>
                <Text style={S.statLabel}>TOTAL RECEIVED</Text>
                <Text style={S.statValue}>{rs(received)}</Text>
              </View>
              <View style={[S.stat, S.statHighlight]}>
                <Text style={S.statLabel}>BALANCE DUE</Text>
                <Text style={[S.statValue, { color: BROWN }]}>{rs(balance)}</Text>
              </View>
            </View>
          </Section>
        )}

        {terms.length > 0 && (
          <Section title="Terms & Conditions">
            <Numbered items={terms} />
          </Section>
        )}

        <View style={S.thanks} wrap={false}>
          <Text style={S.thanksTitle}>Thank You</Text>
          <Text style={S.thanksLine}>Thank you for choosing {studio}.</Text>
          <Text style={S.thanksText}>
            We sincerely appreciate your trust in us and look forward to preserving your beautiful memories with the
            highest quality and professionalism.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
