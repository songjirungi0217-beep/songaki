const NEIS_KEY = process.env.NEIS_KEY;
const ATPT_OFCDC_SC_CODE = process.env.ATPT_OFCDC_SC_CODE;
const SD_SCHUL_CODE = process.env.SD_SCHUL_CODE;

export async function getMeal(dateStr) {
  // dateStr format: YYYYMMDD
  const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${NEIS_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_YMD=${dateStr}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.mealServiceDietInfo) {
      const mealData = data.mealServiceDietInfo[1].row[0].DDISH_NM;
      // 알레르기 정보(숫자)와 불필요한 공백 제거
      return mealData
        .replace(/<br\/>/g, '\n')
        .replace(/\([0-9\.]+\)/g, '') // (1.2.3.) 형식 제거
        .trim();
    }
    return "급식 정보가 없어요.";
  } catch (error) {
    console.error("Meal API Error:", error);
    return "급식 정보를 가져오는 중에 오류가 발생했어요.";
  }
}

export async function getTimetable(grade, classroom, dateStr) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  let sem = (month >= 3 && month <= 8) ? 1 : 2;
  if (month <= 2) year -= 1;

  const url = `https://open.neis.go.kr/hub/hisTimetable?KEY=${NEIS_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&AY=${year}&SEM=${sem}&GRADE=${grade}&CLASS_NM=${classroom}&ALL_TI_YMD=${dateStr}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.hisTimetable) {
      const rows = data.hisTimetable[1].row;
      let result = `📚 ${dateStr.slice(0,4)}-${dateStr.slice(4,6)}-${dateStr.slice(6,8)} / ${grade}학년 ${classroom}반 시간표\n\n`;
      rows.forEach(r => {
        result += `${r.PERIO}교시: ${r.ITRT_CNTNT}\n`;
      });
      return result;
    }
    return `${grade}학년 ${classroom}반의 시간표 정보가 없어요.`;
  } catch (error) {
    console.error("Timetable API Error:", error);
    return "시간표 정보를 가져오는 중에 오류가 발생했어요.";
  }
}

export async function getSchedule(dateStr) {
  // dateStr: YYYYMMDD -> 해당 월의 시작과 끝을 계산하여 한 달 치를 가져옴
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const fromDate = `${year}${month}01`;
  const toDate = `${year}${month}31`; // API가 알아서 말일까지만 처리해줌

  const url = `https://open.neis.go.kr/hub/SchoolSchedule?KEY=${NEIS_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&AA_FROM_YMD=${fromDate}&AA_TO_YMD=${toDate}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.SchoolSchedule) {
      const rows = data.SchoolSchedule[1].row;
      // 일정이 있는 날만 필터링 (공휴일 제외하고 학교 행사 위주)
      const events = rows
        .filter(r => r.EVENT_NM && !['토요일', '일요일'].includes(r.EVENT_NM))
        .map(r => `${r.AA_YMD.slice(4,6)}/${r.AA_YMD.slice(6,8)}: ${r.EVENT_NM}`)
        .join('\n');
      
      return events || "해당 월에는 특별한 일정이 없어.";
    }
    return "학사일정 정보가 없어요.";
  } catch (error) {
    console.error("Schedule API Error:", error);
    return "학사일정 정보를 가져오는 중에 오류가 발생했어요.";
  }
}
