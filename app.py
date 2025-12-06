import streamlit as st
from openai import OpenAI
import requests
from datetime import datetime, timedelta
import re

# ---------------------------
# OpenAI 클라이언트 설정
# ---------------------------
client = OpenAI(
    api_key="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"
)

# ---------------------------
# 학교 기본 정보
# ---------------------------
SCHOOL_NAME = "송악고등학교"
ATPT_OFCDC_SC_CODE = "N10"  
SD_SCHUL_CODE = "8140093"    

# NEIS KEY
NEIS_KEY = "16599893d8a2495a927cc4444f89b8ac"


# ---------------------------
# 날짜 파싱
# ---------------------------
def extract_date(text):
    now = datetime.now()

    if "오늘" in text:
        return now
    if "내일" in text:
        return now + timedelta(days=1)
    if "모레" in text:
        return now + timedelta(days=2)

    weekday_map = {
        "월요일": 0, "월": 0,
        "화요일": 1, "화": 1,
        "수요일": 2, "수": 2,
        "목요일": 3, "목": 3,
        "금요일": 4, "금": 4,
        "토요일": 5, "토": 5,
        "일요일": 6, "일": 6,
    }

    for name, idx in weekday_map.items():
        if f"이번주 {name}" in text or f"이번 주 {name}" in text:
            monday = now - timedelta(days=now.weekday())
            return monday + timedelta(days=idx)

        if f"다음주 {name}" in text or f"다음 주 {name}" in text:
            monday = now - timedelta(days=now.weekday())
            return monday + timedelta(weeks=1, days=idx)

    date_match = re.search(r"(\d{1,2})월\s*(\d{1,2})일", text)
    if date_match:
        month = int(date_match.group(1))
        day = int(date_match.group(2))
        return datetime(now.year, month, day)

    return None


# ---------------------------
# 🔎 학년/반/날짜 추출 (시간표용)
# ---------------------------
def extract_timetable_info(text):
    grade = None
    classroom = None
    date = extract_date(text)

    g = re.search(r"(\d)\s*학년", text)
    if g:
        grade = g.group(1)

    c = re.search(r"(\d)\s*반", text)
    if c:
        classroom = c.group(1)

    if date is None:
        date = datetime.now()

    return grade, classroom, date


# ---------------------------
# 시간표 가져오기
# ---------------------------
def get_timetable(grade, classroom, date):
    now = datetime.now()
    year = now.year
    month = now.month

    # 학기 자동 계산
    if 3 <= month <= 8:
        sem = 1
    else:
        sem = 2

    # 1~2월은 전년도 학년도
    if month <= 2:
        year -= 1

    date_str = date.strftime("%Y%m%d")

    url = (
        f"https://open.neis.go.kr/hub/hisTimetable?"
        f"KEY={NEIS_KEY}&Type=json&ATPT_OFCDC_SC_CODE={ATPT_OFCDC_SC_CODE}"
        f"&SD_SCHUL_CODE={SD_SCHUL_CODE}&AY={year}&SEM={sem}"
        f"&GRADE={grade}&CLASS_NM={classroom}&ALL_TI_YMD={date_str}"
    )

    response = requests.get(url)

    try:
        data = response.json()
        rows = data["hisTimetable"][1]["row"]

        result = f"📚 {date.strftime('%Y-%m-%d')} / {grade}학년 {classroom}반 시간표\n\n"

        for r in rows:
            result += f"{r['PERIO']}교시: {r['ITRT_CNTNT']}\n"

        return result

    except:
        return f"{grade}학년 {classroom}반 {date_str} 시간표가 없어!"


# ---------------------------
# 급식
# ---------------------------
def get_meal(date):
    formatted_date = date.strftime("%Y%m%d")
    url = (
        f"https://open.neis.go.kr/hub/mealServiceDietInfo?KEY={NEIS_KEY}"
        f"&Type=json&ATPT_OFCDC_SC_CODE={ATPT_OFCDC_SC_CODE}"
        f"&SD_SCHUL_CODE={SD_SCHUL_CODE}&MLSV_YMD={formatted_date}"
    )
    response = requests.get(url)

    try:
        data = response.json()
        meal_data = data["mealServiceDietInfo"][1]["row"][0]["DDISH_NM"]
        meal = meal_data.replace("<br/>", "\n")
        return f"🍱 {date.strftime('%Y-%m-%d')} 급식 메뉴\n\n{meal}"
    except:
        return f"{date.strftime('%Y-%m-%d')} 급식 정보가 없어!"


# ---------------------------
# 일정 (문장형)
# ---------------------------
def get_schedule(date):
    formatted_date = date.strftime("%Y%m%d")
    url = (
        f"https://open.neis.go.kr/hub/SchoolSchedule?KEY={NEIS_KEY}"
        f"&Type=json&ATPT_OFCDC_SC_CODE={ATPT_OFCDC_SC_CODE}"
        f"&SD_SCHUL_CODE={SD_SCHUL_CODE}&AA_YMD={formatted_date}"
    )
    response = requests.get(url)

    try:
        data = response.json()
        event = data["SchoolSchedule"][1]["row"][0]["EVENT_NM"]
        return f"{date.strftime('%Y-%m-%d')}에 \"{event}\" 있어."
    except:
        return f"{date.strftime('%Y-%m-%d')}에는 일정이 없어!"


# ---------------------------
# GPT 응답
# ---------------------------
def ask_gpt(user_text):
    system_prompt = f"""
너는 '{SCHOOL_NAME}' 학생들을 돕는 AI 챗봇 '송악이'야.
항상 반말을 쓰고 친구처럼 자연스럽게 대화해.
학교 관련 정보는 반드시 실제 데이터를 기반으로 안내해.
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text}
        ]
    )
    return response.choices[0].message.content


# ---------------------------
# Streamlit UI
# ---------------------------
st.title("📘 송악이")
st.write("송악고 급식 / 학사일정 / 시간표 / 학교 정보 등 뭐든지 물어봐!")

if "messages" not in st.session_state:
    st.session_state["messages"] = []

for msg in st.session_state["messages"]:
    st.chat_message(msg["role"]).write(msg["content"])

user_input = st.chat_input("궁금한 걸 말해줘!")

if user_input:
    st.session_state["messages"].append({"role": "user", "content": user_input})
    st.chat_message("user").write(user_input)

    # 날짜 추출
    date = extract_date(user_input)
    if date is None:
        date = datetime.now()

    # 시간표 요청
    if "시간표" in user_input:
        grade, classroom, d = extract_timetable_info(user_input)
        if grade and classroom:
            answer = get_timetable(grade, classroom, d)
        else:
            answer = "몇 학년 몇 반 시간표인지 알려줘!"

    # 급식
    elif any(k in user_input for k in ["급식", "밥", "메뉴"]):
        answer = get_meal(date)

    # 일정
    elif any(k in user_input for k in ["일정", "행사", "학사"]):
        answer = get_schedule(date)

    # 일반 질문
    else:
        answer = ask_gpt(user_input)

    st.session_state["messages"].append({"role": "assistant", "content": answer})
    st.chat_message("assistant").write(answer)
