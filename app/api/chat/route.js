import { OpenAI } from 'openai';
import { getMeal, getTimetable, getSchedule } from '@/lib/neis';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req) {
  const { messages } = await req.json();

  const tools = [
    {
      type: 'function',
      function: {
        name: 'get_meal',
        description: '특정 날짜의 급식 메뉴를 조회합니다.',
        parameters: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: '조회할 날짜 (YYYYMMDD 형식). 오늘이면 현재 날짜를 입력하세요.',
            },
          },
          required: ['date'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_timetable',
        description: '특정 학년, 반, 날짜의 시간표를 조회합니다.',
        parameters: {
          type: 'object',
          properties: {
            grade: { type: 'string', description: '학년 (1, 2, 3)' },
            classroom: { type: 'string', description: '반' },
            date: { type: 'string', description: '날짜 (YYYYMMDD 형식)' },
          },
          required: ['grade', 'classroom', 'date'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_schedule',
        description: '특정 날짜의 학사일정을 조회합니다.',
        parameters: {
          type: 'object',
          properties: {
            date: { type: 'string', description: '날짜 (YYYYMMDD 형식)' },
          },
          required: ['date'],
        },
      },
    },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '너는 송악고등학교 학생들을 돕는 AI 챗봇 \'송악이\'야. 항상 반말을 쓰고 친구처럼 친근하게 대화해. 학교 관련 정보 요청이 오면 도구를 사용해서 데이터를 가져와서 친절하게 알려줘.',
        },
        ...messages,
      ],
      tools,
      tool_choice: 'auto',
    });

    const responseMessage = response.choices[0].message;

    if (responseMessage.tool_calls) {
      const toolCalls = responseMessage.tool_calls;
      const availableFunctions = {
        get_meal: getMeal,
        get_timetable: getTimetable,
        get_schedule: getSchedule,
      };

      const messagesWithToolCalls = [
        ...messages,
        responseMessage,
      ];

      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionToCall = availableFunctions[functionName];
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        let functionResponse;
        if (functionName === 'get_timetable') {
          functionResponse = await functionToCall(
            functionArgs.grade,
            functionArgs.classroom,
            functionArgs.date
          );
        } else {
          functionResponse = await functionToCall(functionArgs.date);
        }

        messagesWithToolCalls.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          name: functionName,
          content: functionResponse,
        });
      }

      const secondResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
           {
            role: 'system',
            content: '너는 송악고등학교 학생들을 돕는 AI 챗봇 \'송악이\'야. 항상 반말을 쓰고 친구처럼 친근하게 대화해. 가져온 데이터를 바탕으로 학생에게 다정하게 대답해줘.',
          },
          ...messagesWithToolCalls
        ],
      });

      return new Response(JSON.stringify(secondResponse.choices[0].message), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(responseMessage), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('OpenAI Error:', error);
    return new Response(JSON.stringify({ content: '미안, 지금은 대답하기가 좀 힘드네. 나중에 다시 물어봐줄래?' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
