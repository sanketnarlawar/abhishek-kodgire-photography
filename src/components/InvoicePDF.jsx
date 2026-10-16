import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

// ── Brand orange used throughout the invoice ──────────────────────────────
const ORANGE = '#f97316'
const ORANGE_DARK = '#ea580c'
const GRAY = '#6b7280'
const LIGHT_GRAY = '#f3f4f6'
const BORDER = '#e5e7eb'

// ── Utility: convert number to Indian words ───────────────────────────────
const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
  'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']

function toWords(n) {
  n = Math.round(Number(n) || 0)
  if (n === 0) return 'Zero'
  if (n < 0) return 'Minus ' + toWords(-n)
  let w = ''
  if (n >= 10000000) { w += toWords(Math.floor(n / 10000000)) + ' Crore '; n %= 10000000 }
  if (n >= 100000)   { w += toWords(Math.floor(n / 100000)) + ' Lakh '; n %= 100000 }
  if (n >= 1000)     { w += toWords(Math.floor(n / 1000)) + ' Thousand '; n %= 1000 }
  if (n >= 100)      { w += toWords(Math.floor(n / 100)) + ' Hundred '; n %= 100 }
  if (n >= 20)       { w += tens[Math.floor(n / 10)] + ' '; n %= 10 }
  if (n > 0)         { w += ones[n] + ' ' }
  return w.trim()
}

function amountInWords(n) {
  const rupees = Math.floor(n)
  const paise = Math.round((n - rupees) * 100)
  let w = toWords(rupees) + ' Rupees'
  if (paise > 0) w += ' and ' + toWords(paise) + ' Paise'
  return w + ' only'
}

// ── Money formatter ───────────────────────────────────────────────────────
const money = (n) => '₹ ' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric' }).replace(/\//g,'-') : '-'
const fmtTime = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

// ── Styles ────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: { padding: 28, fontSize: 9, color: '#1f2937', fontFamily: 'Helvetica', backgroundColor: '#ffffff' },

  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  studioName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 2 },
  studioMeta: { fontSize: 8, color: GRAY, marginBottom: 1 },
  logo: { width: 80, height: 48, objectFit: 'contain' },
  divider: { height: 1.5, backgroundColor: ORANGE, marginVertical: 8 },

  // Title
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: ORANGE, textAlign: 'center', marginBottom: 8 },

  // Bill To / Invoice Details
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  billLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  billValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 1 },
  billMeta: { fontSize: 8, color: GRAY },
  invLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  invRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 },
  invKey: { fontSize: 8, color: GRAY },
  invVal: { fontSize: 8 },

  // Table
  table: { marginBottom: 8 },
  th: { flexDirection: 'row', backgroundColor: ORANGE, paddingVertical: 5, paddingHorizontal: 4 },
  thText: { fontFamily: 'Helvetica-Bold', color: '#ffffff', fontSize: 8 },
  tr: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 0.5, borderColor: BORDER },
  trAlt: { backgroundColor: LIGHT_GRAY },
  trTotal: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, backgroundColor: LIGHT_GRAY },
  trTotalText: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  cNum: { width: 20 },
  cItem: { flex: 4 },
  cQty: { flex: 1.2, textAlign: 'center' },
  cUnit: { flex: 1.2, textAlign: 'center' },
  cRate: { flex: 1.5, textAlign: 'right' },
  cAmt: { flex: 1.5, textAlign: 'right' },

  // Bottom split
  bottomRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  bottomLeft: { flex: 1 },
  bottomRight: { width: 190 },

  // Left bottom
  descLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 2 },
  descVal: { fontSize: 8, color: GRAY, marginBottom: 6 },
  wordsLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 2 },
  wordsVal: { fontSize: 8, color: GRAY, marginBottom: 6 },
  termsLabel: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 2 },
  termsVal: { fontSize: 7.5, color: GRAY, lineHeight: 1.4 },
  qr: { width: 64, height: 64, marginTop: 8 },
  upiLabel: { fontSize: 7, color: GRAY, marginTop: 2 },

  // Right bottom totals
  totalTable: { borderWidth: 0.5, borderColor: BORDER },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingHorizontal: 6, borderBottomWidth: 0.5, borderColor: BORDER },
  totalKey: { fontSize: 8 },
  totalVal: { fontSize: 8 },
  totalHighlight: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 6, backgroundColor: ORANGE },
  totalHighlightText: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: '#ffffff' },

  // Acknowledgement
  ackDivider: { borderTopWidth: 1, borderColor: BORDER, borderStyle: 'dashed', marginTop: 16, marginBottom: 8 },
  ackTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, textAlign: 'center', marginBottom: 2 },
  ackStudio: { fontFamily: 'Helvetica-Bold', fontSize: 12, color: ORANGE, textAlign: 'center', marginBottom: 8 },
  ackRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ackLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: ORANGE, marginBottom: 2 },
  ackName: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 1 },
  ackMeta: { fontSize: 8, color: GRAY, marginBottom: 1 },
  signBox: { flex: 1, alignItems: 'flex-end', paddingTop: 20 },
  signLine: { width: 120, borderTopWidth: 1, borderColor: '#374151', marginBottom: 2 },
  signLabel: { fontSize: 8, color: GRAY, textAlign: 'right' },
})

// ── Component ─────────────────────────────────────────────────────────────
export default function InvoicePDF({ profile = {}, invoice = {}, client = {}, qrDataUrl, payments = [] }) {
  const items = invoice.items || []
  const totalQty = items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
  const subtotal = Number(invoice.subtotal) || 0
  const total = Number(invoice.total) || 0
  const received = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const balance = Math.max(0, total - received)
  const prevBalance = 0 // could be extended in future

  // Find payment mode from most recent payment
  const lastPayment = payments.length > 0 ? payments[payments.length - 1] : null
  const paymentMode = lastPayment?.mode || 'Cash'

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={S.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={S.studioName}>{profile.studio_name || 'Abhishek Kodgire Photography & Film\'s'}</Text>
            {profile.address ? <Text style={S.studioMeta}>{profile.address}</Text> : null}
            {profile.phone ? <Text style={S.studioMeta}>Phone no. : {profile.phone}</Text> : null}
            {profile.email ? <Text style={S.studioMeta}>Email : {profile.email}</Text> : null}
          </View>
          <View style={{ width: 90, alignItems: 'flex-end' }}>
            {profile.logo_url
              ? <Image src={profile.logo_url} style={S.logo} />
              : <Text style={{ fontSize: 7, color: GRAY }}>Logo</Text>
            }
          </View>
        </View>

        <View style={S.divider} />

        {/* ── Title ──────────────────────────────────────────────── */}
        <Text style={S.title}>Tax Invoice</Text>

        {/* ── Bill To + Invoice Details ───────────────────────────── */}
        <View style={S.billRow}>
          <View style={{ flex: 1 }}>
            <Text style={S.billLabel}>Bill To</Text>
            <Text style={S.billValue}>{client.name || '-'}</Text>
            {client.phone ? <Text style={S.billMeta}>Contact No. : {client.phone}</Text> : null}
            {client.email ? <Text style={S.billMeta}>Email : {client.email}</Text> : null}
            {client.address ? <Text style={S.billMeta}>{client.address}</Text> : null}
          </View>
          <View style={{ width: 200, alignItems: 'flex-end' }}>
            <Text style={S.invLabel}>Invoice Details</Text>
            <View style={S.invRow}>
              <Text style={S.invKey}>Invoice No. : </Text>
              <Text style={S.invVal}>{invoice.invoice_number || '-'}</Text>
            </View>
            <View style={S.invRow}>
              <Text style={S.invKey}>Date : </Text>
              <Text style={S.invVal}>{fmtDate(invoice.issue_date)}</Text>
            </View>
            <View style={S.invRow}>
              <Text style={S.invKey}>Time : </Text>
              <Text style={S.invVal}>{fmtTime()}</Text>
            </View>
            {invoice.event_type ? (
              <View style={S.invRow}>
                <Text style={S.invKey}>Event : </Text>
                <Text style={S.invVal}>{invoice.event_type}</Text>
              </View>
            ) : null}
            {invoice.event_date ? (
              <View style={S.invRow}>
                <Text style={S.invKey}>Event Date : </Text>
                <Text style={S.invVal}>{fmtDate(invoice.event_date)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Items Table ─────────────────────────────────────────── */}
        <View style={S.table}>
          {/* Header */}
          <View style={S.th}>
            <Text style={[S.thText, S.cNum]}>#</Text>
            <Text style={[S.thText, S.cItem]}>Item name</Text>
            <Text style={[S.thText, S.cQty]}>Quantity</Text>
            <Text style={[S.thText, S.cUnit]}>Unit</Text>
            <Text style={[S.thText, S.cRate]}>Price/ Unit</Text>
            <Text style={[S.thText, S.cAmt]}>Amount</Text>
          </View>

          {/* Rows */}
          {items.map((it, i) => (
            <View key={i} style={[S.tr, i % 2 === 1 ? S.trAlt : {}]}>
              <Text style={S.cNum}>{i + 1}</Text>
              <Text style={[S.cItem, { fontFamily: 'Helvetica-Bold', fontSize: 8 }]}>{it.description || '-'}</Text>
              <Text style={S.cQty}>{it.quantity || '-'}</Text>
              <Text style={S.cUnit}>{it.unit || '-'}</Text>
              <Text style={S.cRate}>{money(it.rate)}</Text>
              <Text style={S.cAmt}>{money((Number(it.quantity) || 0) * (Number(it.rate) || 0))}</Text>
            </View>
          ))}

          {/* Total row */}
          <View style={S.trTotal}>
            <Text style={[S.trTotalText, S.cNum]} />
            <Text style={[S.trTotalText, S.cItem]}>Total</Text>
            <Text style={[S.trTotalText, S.cQty]}>{totalQty}</Text>
            <Text style={[S.trTotalText, S.cUnit]} />
            <Text style={[S.trTotalText, S.cRate]} />
            <Text style={[S.trTotalText, S.cAmt]}>{money(total)}</Text>
          </View>
        </View>

        {/* ── Bottom: Left (description, words, terms, QR) + Right (totals) ── */}
        <View style={S.bottomRow}>

          {/* Left */}
          <View style={S.bottomLeft}>
            <Text style={S.descLabel}>Description</Text>
            <Text style={S.descVal}>{paymentMode}</Text>

            <Text style={S.wordsLabel}>Invoice Amount In Words</Text>
            <Text style={S.wordsVal}>{amountInWords(total)}</Text>

            {profile.terms ? (
              <>
                <Text style={S.termsLabel}>Terms and Conditions</Text>
                <Text style={S.termsVal}>{profile.terms}</Text>
              </>
            ) : null}

            {/* QR */}
            {qrDataUrl ? (
              <View style={{ marginTop: 8 }}>
                <Image src={qrDataUrl} style={S.qr} />
                <Text style={S.upiLabel}>UPI SCAN TO PAY</Text>
              </View>
            ) : null}
          </View>

          {/* Right totals */}
          <View style={S.bottomRight}>
            <View style={S.totalTable}>
              <View style={S.totalRow}>
                <Text style={S.totalKey}>Sub Total</Text>
                <Text style={S.totalVal}>{money(subtotal)}</Text>
              </View>
              <View style={S.totalHighlight}>
                <Text style={S.totalHighlightText}>Total</Text>
                <Text style={S.totalHighlightText}>{money(total)}</Text>
              </View>
              <View style={S.totalRow}>
                <Text style={S.totalKey}>Received</Text>
                <Text style={S.totalVal}>{money(received)}</Text>
              </View>
              <View style={S.totalRow}>
                <Text style={S.totalKey}>Balance</Text>
                <Text style={S.totalVal}>{money(balance)}</Text>
              </View>
              <View style={S.totalRow}>
                <Text style={S.totalKey}>Payment mode</Text>
                <Text style={S.totalVal}>{paymentMode}</Text>
              </View>
              <View style={S.totalRow}>
                <Text style={S.totalKey}>Previous Balance</Text>
                <Text style={S.totalVal}>{money(prevBalance)}</Text>
              </View>
              <View style={[S.totalRow, { borderBottomWidth: 0 }]}>
                <Text style={[S.totalKey, { fontFamily: 'Helvetica-Bold' }]}>Current Balance</Text>
                <Text style={[S.totalVal, { fontFamily: 'Helvetica-Bold' }]}>{money(balance + prevBalance)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Acknowledgement tear-off ────────────────────────────── */}
        <View style={S.ackDivider} />

        <Text style={S.ackTitle}>Acknowledgement</Text>
        <Text style={S.ackStudio}>
          {(profile.studio_name || 'ABHISHEK KODGIRE PHOTOGRAPHY & FILM\'S').toUpperCase()}
        </Text>

        <View style={S.ackRow}>
          {/* Invoice To */}
          <View style={{ flex: 1 }}>
            <Text style={S.ackLabel}>Invoice To:</Text>
            <Text style={S.ackName}>{client.name || '-'}</Text>
            {client.phone ? <Text style={S.ackMeta}>{client.phone}</Text> : null}
          </View>

          {/* Invoice Details */}
          <View style={{ flex: 1.5 }}>
            <Text style={S.ackLabel}>Invoice Details:</Text>
            <Text style={S.ackMeta}>Invoice No. : {invoice.invoice_number || '-'}</Text>
            <Text style={S.ackMeta}>Invoice date : {fmtDate(invoice.issue_date)}</Text>
            <Text style={S.ackMeta}>Invoice Amount : {money(total)}</Text>
          </View>

          {/* Receiver's seal */}
          <View style={S.signBox}>
            <View style={S.signLine} />
            <Text style={S.signLabel}>Receiver's Seal & Sign</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}
