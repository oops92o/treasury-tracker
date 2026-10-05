// 30년물 국채 입찰 위젯 (Scriptable)
//
// 설치 방법
// 1. Scriptable 앱에서 + 를 눌러 새 스크립트를 만들고 이 파일 내용을 붙여넣는다.
// 2. ▶ 버튼으로 실행하면 위젯 미리보기가 뜬다.
// 3. 홈 화면에 Scriptable 작은 위젯을 추가하고, 위젯 편집 → Script 에서 이 스크립트를 고른다.
//
// 데이터는 GitHub Actions 가 평일 한국시간 18:00 에 갱신하는 data.json 을 읽는다.

const URL = "https://raw.githubusercontent.com/oops92o/treasury-tracker/main/data.json"

async function loadData() {
  const req = new Request(URL)
  req.timeoutInterval = 15
  return await req.loadJSON()
}

// 평균보다 높으면 ▲, 낮으면 ▼
function arrow(value, avg) {
  if (value > avg) return "▲"
  if (value < avg) return "▼"
  return "–"
}

function addRow(widget, label, value, color) {
  const row = widget.addStack()
  row.centerAlignContent()
  const l = row.addText(label)
  l.font = Font.systemFont(12)
  l.textColor = Color.gray()
  row.addSpacer()
  const v = row.addText(value)
  v.font = Font.boldSystemFont(14)
  if (color) v.textColor = color
}

async function createWidget() {
  const w = new ListWidget()
  w.backgroundColor = Color.dynamic(new Color("#ffffff"), new Color("#1c1c1e"))
  w.setPadding(12, 14, 12, 14)
  // 1시간 뒤 다시 불러오기 요청 (실제 갱신 시점은 iOS가 정함)
  w.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000)

  let data
  try {
    data = await loadData()
  } catch (e) {
    const t = w.addText("데이터를 불러오지 못했어요")
    t.font = Font.systemFont(12)
    return w
  }

  const latest = data.latest
  const avg = data.recent_12_avg

  const title = w.addText("미 30년물 입찰")
  title.font = Font.boldSystemFont(13)
  const date = w.addText(latest.auction_date)
  date.font = Font.systemFont(11)
  date.textColor = Color.gray()
  w.addSpacer(6)

  addRow(w, "금리", latest.high_yield.toFixed(3) + "%")
  addRow(w, "응찰률",
    arrow(latest.bid_to_cover_ratio, avg.bid_to_cover_ratio) + " " +
    latest.bid_to_cover_ratio.toFixed(2))
  addRow(w, "간접입찰",
    arrow(latest.indirect_bidder_share, avg.indirect_bidder_share) + " " +
    latest.indirect_bidder_share.toFixed(1) + "%")

  w.addSpacer(6)
  const msg = data.signals.length ? data.signals.join(", ") : "평균 수준, 특이 신호 없음"
  const s = w.addText(msg)
  s.font = Font.systemFont(10)
  s.textColor = data.signals.length ? Color.orange() : Color.gray()
  s.minimumScaleFactor = 0.7

  return w
}

const widget = await createWidget()
if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  await widget.presentSmall()   // 앱에서 실행하면 미리보기
}
Script.complete()
