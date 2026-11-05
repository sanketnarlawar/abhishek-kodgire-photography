import { Document, Page, Text, View, Image, Font, StyleSheet } from '@react-pdf/renderer'
import { amountInWords, formatDate, quotationInvoiceName, quotationInvoiceNumber, today } from '../lib/format'
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

const ORANGE = '#f97316'
const GRAY = '#6b7280'
const LIGHT_GRAY = '#f3f4f6'
const BORDER = '#e5e7eb'

const money = (n) => `\u20b9 ${(Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
const fmtDate = (d) => (d ? formatDate(d).replace(/ /g, '-') : '-')
const lines = (text) => (text || '').split('\n').map((l) => l.trim()).filter(Boolean)

const S = StyleSheet.create({
  page: { padding: 28, fontSize: 9, color: '#1f2937', fontFamily: 'NotoSans', backgroundColor: '#ffffff' },

  headerRow: { alignItems: 'center' },
  logo: { width: 260, height: 90 },
  studioMeta: { fontSize: 8, color: GRAY, marginTop: 2, textAlign: 'center' },
  divider: { height: 1.5, backgroundColor: ORANGE, marginVertical: 8 },
  title: { fontSize: 16, fontWeight: 700, color: ORANGE, textAlign: 'center', marginBottom: 8 },

  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  billLabel: { fontSize: 9, fontWeight: 700, marginBottom: 2 },
  billValue: { fontSize: 10, fontWeight: 700, marginBottom: 1 },
  billMeta: { fontSize: 8, color: GRAY, marginBottom: 1 },
  invRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 },
  invKey: { fontSize: 8, color: GRAY },
  invVal: { fontSize: 8 },

  sectionLabel: { fontSize: 9, fontWeight: 700, marginBottom: 3 },
  table: { marginBottom: 8 },
  th: { flexDirection: 'row', backgroundColor: ORANGE, paddingVertical: 5, paddingHorizontal: 4 },
  thText: { fontWeight: 700, color: '#ffffff', fontSize: 8 },
  tr: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 0.5, borderColor: BORDER },
  trAlt: { backgroundColor: LIGHT_GRAY },
  cNum: { width: 20 },
  cEvent: { flex: 1.8 },
  cLoc: { flex: 1.5 },
  cServ: { flex: 4.2 },
  cDate: { flex: 1.2 },
  cMode: { flex: 2 },
  cAmt: { flex: 1.5, textAlign: 'right' },

  bottomRow: { flexDirection: 'row', marginTop: 4 },
  bottomLeft: { flex: 1, paddingRight: 12 },
  bottomRight: { width: 190 },
  wordsLabel: { fontWeight: 700, fontSize: 9, marginBottom: 2 },
  wordsVal: { fontSize: 8, color: GRAY, marginBottom: 6 },
  termsVal: { fontSize: 7.5, color: GRAY, lineHeight: 1.4, marginBottom: 1 },

  totalTable: { borderWidth: 0.5, borderColor: BORDER },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingHorizontal: 6, borderBottomWidth: 0.5, borderColor: BORDER },
  totalKey: { fontSize: 8 },
  totalVal: { fontSize: 8 },
  totalHighlight: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingHorizontal: 6, backgroundColor: ORANGE },
  totalHighlightText: { fontWeight: 700, fontSize: 9, color: '#ffffff' },

  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 48 },
  signBox: { width: 150 },
  signLine: { borderTopWidth: 1, borderColor: '#374151', marginBottom: 2 },
  signLabel: { fontSize: 8, color: GRAY, textAlign: 'center' },
})

// Services stack vertically, five per column, spilling into a new column after that.
function ServiceColumns({ services }) {
  if (services.length === 0) return <Text style={[S.cServ, { fontSize: 8 }]}>-</Text>
  const columns = []
  for (let i = 0; i < services.length; i += 5) columns.push(services.slice(i, i + 5))
  return (
    <View style={[S.cServ, { flexDirection: 'row' }]}>
      {columns.map((col, c) => (
        <View key={c} style={{ flex: 1, paddingRight: 6 }}>
          {col.map((name, i) => (
            <Text key={i} style={{ fontSize: 8, marginBottom: 1 }}>
              {'\u2022 '}
              {name}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

export default function QuotationInvoicePDF({ profile = {}, quotation = {}, client = {} }) {
  const details = quotation.details || {}
  const schedule = details.schedule || []
  const eventServices = schedule.some((ev) => (ev.services || []).length > 0)
  const flatServices = (quotation.items || []).map((it) => it.description).filter(Boolean)
  const payments = details.payments || []
  const terms = lines(quotation.notes)

  const subtotal = Number(quotation.subtotal) || 0
  const discount = Number(quotation.discount) || 0
  const total = Number(quotation.total) || 0
  const received = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const balance = Math.max(0, total - received)

  const studio = profile.studio_name || 'Abhishek Kodgire Photography & Films'
  const phone = details.phone || client.phone
  const address = details.billing_address || client.address

  return (
    <Document title={quotationInvoiceName(quotation, profile, client)}>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.headerRow}>
          <Image src={logoBlack} style={S.logo} />
          {profile.address ? <Text style={S.studioMeta}>{profile.address}</Text> : null}
          {profile.email ? <Text style={S.studioMeta}>Email : {profile.email}</Text> : null}
        </View>

        <View style={S.divider} />
        <Text style={S.title}>Invoice</Text>

        {/* Bill To + Invoice Details */}
        <View style={S.billRow}>
          <View style={{ flex: 1 }}>
            <Text style={S.billValue}>Name : {client.name || '-'}</Text>
            {phone ? <Text style={S.billMeta}>Contact No. : {phone}</Text> : null}
            {client.email ? <Text style={S.billMeta}>Email : {client.email}</Text> : null}
            {address ? <Text style={S.billMeta}>{address}</Text> : null}
          </View>
          <View style={{ width: 200, alignItems: 'flex-end' }}>
            <Text style={S.billLabel}>Invoice Details</Text>
            <View style={S.invRow}>
              <Text style={S.invKey}>Invoice No. : </Text>
              <Text style={S.invVal}>{quotationInvoiceNumber(quotation, profile)}</Text>
            </View>
            <View style={S.invRow}>
              <Text style={S.invKey}>Date : </Text>
              <Text style={S.invVal}>{fmtDate(today())}</Text>
            </View>
            {quotation.event_type ? (
              <View style={S.invRow}>
                <Text style={S.invKey}>Event : </Text>
                <Text style={S.invVal}>{quotation.event_type}</Text>
              </View>
            ) : null}
            {quotation.event_date ? (
              <View style={S.invRow}>
                <Text style={S.invKey}>Event Date : </Text>
                <Text style={S.invVal}>{fmtDate(quotation.event_date)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Event wise services */}
        {schedule.length > 0 ? (
          <View style={S.table}>
            <View style={S.th}>
              <Text style={[S.thText, S.cNum]}>#</Text>
              <Text style={[S.thText, S.cEvent]}>Event / Date</Text>
              <Text style={[S.thText, S.cLoc]}>Location</Text>
              <Text style={[S.thText, S.cServ]}>Services</Text>
            </View>
            {schedule.map((ev, i) => (
              <View key={ev.id || i} style={[S.tr, i % 2 === 1 ? S.trAlt : {}]} wrap={false}>
                <Text style={S.cNum}>{i + 1}</Text>
                <View style={S.cEvent}>
                  <Text style={{ fontWeight: 700, fontSize: 8 }}>{ev.event || `Event ${i + 1}`}</Text>
                  {ev.date ? <Text style={S.billMeta}>{fmtDate(ev.date)}</Text> : null}
                  {ev.coverage ? <Text style={S.billMeta}>{ev.coverage}</Text> : null}
                </View>
                <Text style={[S.cLoc, { fontSize: 8 }]}>{ev.location || '-'}</Text>
                <ServiceColumns services={ev.services || []} />
              </View>
            ))}
          </View>
        ) : null}

        {flatServices.length > 0 && !eventServices ? (
          <View style={S.table}>
            <View style={S.th}>
              <Text style={[S.thText, S.cNum]}>#</Text>
              <Text style={[S.thText, { flex: 1 }]}>Services</Text>
            </View>
            {flatServices.map((name, i) => (
              <View key={i} style={[S.tr, i % 2 === 1 ? S.trAlt : {}]} wrap={false}>
                <Text style={S.cNum}>{i + 1}</Text>
                <Text style={{ flex: 1, fontSize: 8 }}>{name}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Payments received */}
        {received > 0 ? (
          <View style={S.table}>
            <Text style={S.sectionLabel}>Payments Received</Text>
            <View style={S.th}>
              <Text style={[S.thText, S.cDate]}>Date</Text>
              <Text style={[S.thText, S.cMode]}>Mode</Text>
              <Text style={[S.thText, S.cAmt]}>Amount</Text>
            </View>
            {payments.map((p, i) => (
              <View key={i} style={[S.tr, i % 2 === 1 ? S.trAlt : {}]} wrap={false}>
                <Text style={S.cDate}>{fmtDate(p.date)}</Text>
                <Text style={S.cMode}>{[p.mode, p.type].filter(Boolean).join(' - ') || '-'}</Text>
                <Text style={S.cAmt}>{money(p.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Words + terms (left), totals (right) */}
        <View style={S.bottomRow} wrap={false}>
          <View style={S.bottomLeft}>
            <Text style={S.wordsLabel}>Invoice Amount In Words</Text>
            <Text style={S.wordsVal}>{amountInWords(total)}</Text>
            {terms.length > 0 ? (
              <>
                <Text style={S.wordsLabel}>Terms and Conditions</Text>
                {terms.map((t, i) => (
                  <Text key={i} style={S.termsVal}>
                    {i + 1}. {t}
                  </Text>
                ))}
              </>
            ) : null}
          </View>

          <View style={S.bottomRight}>
            <View style={S.totalTable}>
              <View style={S.totalRow}>
                <Text style={S.totalKey}>Sub Total</Text>
                <Text style={S.totalVal}>{money(subtotal)}</Text>
              </View>
              {discount > 0 ? (
                <View style={S.totalRow}>
                  <Text style={S.totalKey}>Discount</Text>
                  <Text style={S.totalVal}>- {money(discount)}</Text>
                </View>
              ) : null}
              <View style={S.totalHighlight}>
                <Text style={S.totalHighlightText}>Total Package</Text>
                <Text style={S.totalHighlightText}>{money(total)}</Text>
              </View>
              <View style={S.totalRow}>
                <Text style={S.totalKey}>Received</Text>
                <Text style={S.totalVal}>{money(received)}</Text>
              </View>
              <View style={[S.totalRow, { borderBottomWidth: 0 }]}>
                <Text style={[S.totalKey, { fontWeight: 700 }]}>Balance</Text>
                <Text style={[S.totalVal, { fontWeight: 700 }]}>{money(balance)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Signatures */}
        <View style={S.signRow} wrap={false}>
          <View style={S.signBox}>
            <View style={S.signLine} />
            <Text style={S.signLabel}>Customer Signature</Text>
          </View>
          <View style={S.signBox}>
            <View style={S.signLine} />
            <Text style={S.signLabel}>For {studio}</Text>
            <Text style={S.signLabel}>Authorised Signatory</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
