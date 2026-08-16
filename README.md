# treasury-tracker
30y treasury tracker
"""
30년물 국채 응찰률(bid-to-cover ratio) + 간접입찰자 비중 트래커
데이터 출처: U.S. Treasury Fiscal Data API (인증 불필요, 무료)
공식 문서: https://fiscaldata.treasury.gov/api-documentation/
"""

import requests
import pandas as pd

BASE_URL = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query"

FIELDS = [
    "auction_date", "security_type", "security_term", "inflation_index_security",
    "high_yield", "bid_to_cover_ratio", "offering_amt", "total_tendered", "total_accepted",
    "primary_dealer_accepted", "direct_bidder_accepted", "indirect_bidder_accepted",
]


def fetch_30y_auctions(page_size: int = 40) -> pd.DataFrame:
    """최근 30년물 국채 입찰 결과(응찰률 + 간접입찰자 비중)를 가져온다."""
    params = {
        "fields": ",".join(FIELDS),
        "filter": "security_term:eq:30-Year",
        "sort": "-auction_date",
        "page[size]": page_size,
    }

    resp = requests.get(BASE_URL, params=params, timeout=15)

    if resp.status_code == 400:
        print("일부 필드명이 잘못됐을 수 있어요. 아래는 서버 응답입니다:")
        print(resp.text)
        print("\n해결 방법: 아래처럼 fields 파라미터를 빼고 전체 필드를 한번 받아서")
        print("df.columns.tolist() 로 정확한 필드명을 확인한 뒤 FIELDS 리스트를 고치세요.")
        raise SystemExit(1)

    resp.raise_for_status()
    payload = resp.json()

    df = pd.DataFrame(payload["data"])

    df = df[df["inflation_index_security"] != "Yes"].copy()

    df["auction_date"] = pd.to_datetime(df["auction_date"])
    numeric_cols = ["high_yield", "bid_to_cover_ratio", "offering_amt", "total_tendered",
                     "total_accepted", "primary_dealer_accepted", "direct_bidder_accepted",
                     "indirect_bidder_accepted"]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df["indirect_bidder_share"] = df["indirect_bidder_accepted"] / df["total_accepted"] * 100

    return df.sort_values("auction_date")


if __name__ == "__main__":
    df = fetch_30y_auctions()
    cols = ["auction_date", "high_yield", "bid_to_cover_ratio", "indirect_bidder_share"]
    print(df[cols].to_string(index=False))

    recent = df.tail(12)
    latest = df.iloc[-1]

    avg_btc = recent["bid_to_cover_ratio"].mean()
    avg_indirect = recent["indirect_bidder_share"].mean()

    print(f"\n최근 12회 평균 응찰률: {avg_btc:.2f} / 평균 간접입찰 비중: {avg_indirect:.1f}%")
    print(f"최신({latest['auction_date'].date()}) 응찰률: {latest['bid_to_cover_ratio']:.2f} "
          f"/ 간접입찰 비중: {latest['indirect_bidder_share']:.1f}%")

    signals = []
    if latest["bid_to_cover_ratio"] < avg_btc - 0.1:
        signals.append("응찰률 평균 대비 약함")
    elif latest["bid_to_cover_ratio"] > avg_btc + 0.1:
        signals.append("응찰률 평균 대비 강함")

    if latest["indirect_bidder_share"] < avg_indirect - 3:
        signals.append("해외(간접입찰) 수요 평균 대비 약함")
    elif latest["indirect_bidder_share"] > avg_indirect + 3:
        signals.append("해외(간접입찰) 수요 평균 대비 강함")

    print("→ " + (", ".join(signals) if signals else "평균 수준의 수요, 특이 신호 없음"))
