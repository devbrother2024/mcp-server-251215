import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { InferenceClient } from '@huggingface/inference'
import { z } from 'zod'

// Create server instance
const server = new McpServer({
    name: 'my-mcp-server',
    version: '1.0.0'
})

// 도구 정보를 저장할 배열
const toolsInfo: Array<{
    name: string
    description: string
    inputSchema: Record<string, unknown>
}> = []

// greet 도구 정보 저장
toolsInfo.push({
    name: 'greet',
    description: '이름과 언어를 입력하면 인사말을 반환합니다.',
    inputSchema: {
        name: { type: 'string', description: '인사할 사람의 이름' },
        language: {
            type: 'enum',
            values: ['ko', 'en'],
            optional: true,
            default: 'en',
            description: '인사 언어 (기본값: en)'
        }
    }
})

server.registerTool(
    'greet',
    {
        description: '이름과 언어를 입력하면 인사말을 반환합니다.',
        inputSchema: z.object({
            name: z.string().describe('인사할 사람의 이름'),
            language: z
                .enum(['ko', 'en'])
                .optional()
                .default('en')
                .describe('인사 언어 (기본값: en)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('인사말')
                    })
                )
                .describe('인사말')
        })
    },
    async ({ name, language }) => {
        const greeting =
            language === 'ko'
                ? `안녕하세요, ${name}님!`
                : `Hey there, ${name}! 👋 Nice to meet you!`

        return {
            content: [
                {
                    type: 'text' as const,
                    text: greeting
                }
            ],
            structuredContent: {
                content: [
                    {
                        type: 'text' as const,
                        text: greeting
                    }
                ]
            }
        }
    }
)

// calculator 도구 정보 저장
toolsInfo.push({
    name: 'calculator',
    description: '두 개의 숫자와 연산자를 입력받아 사칙연산 결과를 반환합니다.',
    inputSchema: {
        num1: { type: 'number', description: '첫 번째 숫자' },
        num2: { type: 'number', description: '두 번째 숫자' },
        operator: {
            type: 'enum',
            values: ['+', '-', '*', '/'],
            description: '연산자 (+, -, *, /)'
        }
    }
})

server.registerTool(
    'calculator',
    {
        description:
            '두 개의 숫자와 연산자를 입력받아 사칙연산 결과를 반환합니다.',
        inputSchema: z.object({
            num1: z.number().describe('첫 번째 숫자'),
            num2: z.number().describe('두 번째 숫자'),
            operator: z
                .enum(['+', '-', '*', '/'])
                .describe('연산자 (+, -, *, /)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('계산 결과')
                    })
                )
                .describe('계산 결과')
        })
    },
    async ({ num1, num2, operator }) => {
        let result: number

        switch (operator) {
            case '+':
                result = num1 + num2
                break
            case '-':
                result = num1 - num2
                break
            case '*':
                result = num1 * num2
                break
            case '/':
                if (num2 === 0) {
                    throw new Error('0으로 나눌 수 없습니다.')
                }
                result = num1 / num2
                break
            default:
                throw new Error(`지원하지 않는 연산자입니다: ${operator}`)
        }

        const resultText = `${num1} ${operator} ${num2} = ${result}`

        return {
            content: [
                {
                    type: 'text' as const,
                    text: resultText
                }
            ],
            structuredContent: {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ]
            }
        }
    }
)

// time 도구 정보 저장
toolsInfo.push({
    name: 'time',
    description: 'timezone을 입력받아 해당 시간대의 현재 시간을 반환합니다.',
    inputSchema: {
        timezone: {
            type: 'string',
            description:
                '시간대 (예: Asia/Seoul, America/New_York, Europe/London, UTC 등)'
        }
    }
})

server.registerTool(
    'time',
    {
        description:
            'timezone을 입력받아 해당 시간대의 현재 시간을 반환합니다.',
        inputSchema: z.object({
            timezone: z
                .string()
                .describe(
                    '시간대 (예: Asia/Seoul, America/New_York, Europe/London, UTC 등)'
                )
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('현재 시간')
                    })
                )
                .describe('현재 시간')
        })
    },
    async ({ timezone }) => {
        try {
            const now = new Date()
            const formatter = new Intl.DateTimeFormat('ko-KR', {
                timeZone: timezone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            })

            const formattedTime = formatter.format(now)
            const resultText = `${timezone} 시간대의 현재 시간: ${formattedTime}`

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        } catch (error) {
            throw new Error(
                `유효하지 않은 시간대입니다: ${timezone}. 올바른 IANA 시간대를 입력해주세요. (예: Asia/Seoul, America/New_York)`
            )
        }
    }
)

// geocode 도구 정보 저장
toolsInfo.push({
    name: 'geocode',
    description: '도시 이름이나 주소를 입력받아 위도와 경도 좌표를 반환합니다.',
    inputSchema: {
        address: {
            type: 'string',
            description: '도시 이름이나 주소 (예: 서울, New York, Paris 등)'
        }
    }
})

server.registerTool(
    'geocode',
    {
        description:
            '도시 이름이나 주소를 입력받아 위도와 경도 좌표를 반환합니다.',
        inputSchema: z.object({
            address: z
                .string()
                .describe('도시 이름이나 주소 (예: 서울, New York, Paris 등)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('위도와 경도 좌표')
                    })
                )
                .describe('위도와 경도 좌표')
        })
    },
    async ({ address }) => {
        try {
            const encodedAddress = encodeURIComponent(address)
            const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'MCP-Server/1.0.0'
                }
            })

            if (!response.ok) {
                throw new Error(
                    `Nominatim API 요청 실패: ${response.status} ${response.statusText}`
                )
            }

            const data = await response.json()

            if (!Array.isArray(data) || data.length === 0) {
                throw new Error(`주소를 찾을 수 없습니다: ${address}`)
            }

            const result = data[0]
            const lat = parseFloat(result.lat)
            const lon = parseFloat(result.lon)
            const displayName = result.display_name || address

            const resultText = `주소: ${displayName}\n위도: ${lat}\n경도: ${lon}`

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        } catch (error) {
            if (error instanceof Error) {
                throw error
            }
            throw new Error(`지오코딩 중 오류가 발생했습니다: ${String(error)}`)
        }
    }
)

// get-weather 도구 정보 저장
toolsInfo.push({
    name: 'get-weather',
    description:
        '위도와 경도 좌표, 예보 기간을 입력받아 해당 위치의 현재 날씨와 예보 정보를 제공합니다.',
    inputSchema: {
        latitude: {
            type: 'number',
            min: -90,
            max: 90,
            description: '위도 (WGS84 좌표계, -90 ~ 90)'
        },
        longitude: {
            type: 'number',
            min: -180,
            max: 180,
            description: '경도 (WGS84 좌표계, -180 ~ 180)'
        },
        forecastDays: {
            type: 'number',
            min: 1,
            max: 16,
            optional: true,
            default: 7,
            description: '예보 기간 (일 단위, 기본값: 7, 최대: 16)'
        }
    }
})

server.registerTool(
    'get-weather',
    {
        description:
            '위도와 경도 좌표, 예보 기간을 입력받아 해당 위치의 현재 날씨와 예보 정보를 제공합니다.',
        inputSchema: z.object({
            latitude: z
                .number()
                .min(-90)
                .max(90)
                .describe('위도 (WGS84 좌표계, -90 ~ 90)'),
            longitude: z
                .number()
                .min(-180)
                .max(180)
                .describe('경도 (WGS84 좌표계, -180 ~ 180)'),
            forecastDays: z
                .number()
                .int()
                .min(1)
                .max(16)
                .optional()
                .default(7)
                .describe('예보 기간 (일 단위, 기본값: 7, 최대: 16)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('text'),
                        text: z.string().describe('날씨 정보')
                    })
                )
                .describe('날씨 정보')
        })
    },
    async ({ latitude, longitude, forecastDays = 7 }) => {
        try {
            const params = new URLSearchParams({
                latitude: latitude.toString(),
                longitude: longitude.toString(),
                forecast_days: forecastDays.toString(),
                current:
                    'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
                hourly: 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m',
                daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code',
                timezone: 'auto'
            })

            const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`

            const response = await fetch(url)

            if (!response.ok) {
                throw new Error(
                    `Open-Meteo API 요청 실패: ${response.status} ${response.statusText}`
                )
            }

            const data = await response.json()

            if (data.error) {
                throw new Error(`Open-Meteo API 오류: ${data.reason}`)
            }

            // 현재 날씨 정보
            const current = data.current
            const currentUnits = data.current_units || {}
            const currentTemp = current?.temperature_2m
            const currentHumidity = current?.relative_humidity_2m
            const currentWeatherCode = current?.weather_code
            const currentWindSpeed = current?.wind_speed_10m

            // 일별 예보 정보
            const daily = data.daily
            const dailyUnits = data.daily_units || {}
            const dailyTimes = daily?.time || []
            const dailyMaxTemps = daily?.temperature_2m_max || []
            const dailyMinTemps = daily?.temperature_2m_min || []
            const dailyPrecip = daily?.precipitation_sum || []
            const dailyWeatherCodes = daily?.weather_code || []

            // 결과 텍스트 생성
            let resultText = `=== 현재 날씨 ===\n`
            if (currentTemp !== undefined) {
                resultText += `온도: ${currentTemp}${
                    currentUnits.temperature_2m || '°C'
                }\n`
            }
            if (currentHumidity !== undefined) {
                resultText += `습도: ${currentHumidity}${
                    currentUnits.relative_humidity_2m || '%'
                }\n`
            }
            if (currentWindSpeed !== undefined) {
                resultText += `풍속: ${currentWindSpeed}${
                    currentUnits.wind_speed_10m || 'km/h'
                }\n`
            }
            if (currentWeatherCode !== undefined) {
                resultText += `날씨 코드: ${currentWeatherCode}\n`
            }

            resultText += `\n=== ${forecastDays}일 예보 ===\n`

            for (
                let i = 0;
                i < Math.min(dailyTimes.length, forecastDays);
                i++
            ) {
                const date = dailyTimes[i]
                const maxTemp = dailyMaxTemps[i]
                const minTemp = dailyMinTemps[i]
                const precip = dailyPrecip[i]
                const weatherCode = dailyWeatherCodes[i]

                resultText += `\n${date}:\n`
                if (maxTemp !== undefined && minTemp !== undefined) {
                    resultText += `  최고/최저: ${maxTemp}°C / ${minTemp}°C\n`
                }
                if (precip !== undefined) {
                    resultText += `  강수량: ${precip}${
                        dailyUnits.precipitation_sum || 'mm'
                    }\n`
                }
                if (weatherCode !== undefined) {
                    resultText += `  날씨 코드: ${weatherCode}\n`
                }
            }

            resultText += `\n위치: 위도 ${latitude}, 경도 ${longitude}`
            if (data.timezone) {
                resultText += `\n시간대: ${data.timezone}`
            }

            return {
                content: [
                    {
                        type: 'text' as const,
                        text: resultText
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'text' as const,
                            text: resultText
                        }
                    ]
                }
            }
        } catch (error) {
            if (error instanceof Error) {
                throw error
            }
            throw new Error(
                `날씨 정보 조회 중 오류가 발생했습니다: ${String(error)}`
            )
        }
    }
)

// generate-image 도구 정보 저장
toolsInfo.push({
    name: 'generate-image',
    description:
        '텍스트 프롬프트를 입력받아 AI 이미지를 생성합니다. (FLUX.1-schnell 모델 사용)',
    inputSchema: {
        prompt: {
            type: 'string',
            description: '생성할 이미지에 대한 설명 (영어 권장)'
        }
    }
})

server.registerTool(
    'generate-image',
    {
        description:
            '텍스트 프롬프트를 입력받아 AI 이미지를 생성합니다. (FLUX.1-schnell 모델 사용)',
        inputSchema: z.object({
            prompt: z.string().describe('생성할 이미지에 대한 설명 (영어 권장)')
        }),
        outputSchema: z.object({
            content: z
                .array(
                    z.object({
                        type: z.literal('image'),
                        data: z
                            .string()
                            .describe('Base64 인코딩된 이미지 데이터'),
                        mimeType: z.string().describe('이미지 MIME 타입')
                    })
                )
                .describe('생성된 이미지')
        })
    },
    async ({ prompt }) => {
        try {
            const hfToken = process.env.HF_TOKEN
            if (!hfToken) {
                throw new Error(
                    'HF_TOKEN 환경 변수가 설정되지 않았습니다. Hugging Face API 토큰을 설정해주세요.'
                )
            }

            const client = new InferenceClient(hfToken)

            // MCP 서버는 stdout을 JSON-RPC 통신에 사용하므로 console.log를 일시적으로 억제
            const originalLog = console.log
            console.log = () => {}

            let image: Blob
            try {
                image = (await client.textToImage({
                    provider: 'auto',
                    model: 'black-forest-labs/FLUX.1-schnell',
                    inputs: prompt,
                    parameters: { num_inference_steps: 5 }
                })) as unknown as Blob
            } finally {
                // console.log 복원
                console.log = originalLog
            }

            // Blob을 Base64로 변환
            const arrayBuffer = await image.arrayBuffer()
            const base64Data = Buffer.from(arrayBuffer).toString('base64')

            return {
                content: [
                    {
                        type: 'image' as const,
                        data: base64Data,
                        mimeType: 'image/png'
                    }
                ],
                structuredContent: {
                    content: [
                        {
                            type: 'image' as const,
                            data: base64Data,
                            mimeType: 'image/png'
                        }
                    ]
                }
            }
        } catch (error) {
            if (error instanceof Error) {
                throw error
            }
            throw new Error(
                `이미지 생성 중 오류가 발생했습니다: ${String(error)}`
            )
        }
    }
)

// 서버 정보 리소스 등록
server.registerResource(
    'server-info',
    'server://info',
    {
        description: '현재 서버 정보와 사용 가능한 도구 목록을 반환합니다.',
        mimeType: 'application/json'
    },
    async () => {
        const serverInfo = {
            server: {
                name: 'my-mcp-server',
                version: '1.0.0',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            },
            tools: toolsInfo.map(tool => ({
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema
            }))
        }

        return {
            contents: [
                {
                    uri: 'server://info',
                    mimeType: 'application/json',
                    text: JSON.stringify(serverInfo, null, 2)
                }
            ]
        }
    }
)

// 코드 리뷰 프롬프트 템플릿
const codeReviewPromptTemplate = `다음 코드를 리뷰해주세요. 다음 항목들을 중점적으로 검토해주세요:

1. **코드 품질**
   - 가독성과 명확성
   - 코드 스타일과 일관성
   - 네이밍 컨벤션

2. **버그 및 잠재적 문제**
   - 논리적 오류
   - 엣지 케이스 처리
   - 예외 처리

3. **성능**
   - 최적화 가능한 부분
   - 불필요한 연산이나 리소스 사용

4. **보안**
   - 보안 취약점
   - 입력 검증
   - 데이터 보호

5. **개선 제안**
   - 리팩토링 제안
   - 베스트 프랙티스 적용
   - 코드 구조 개선

코드:
\`\`\`
{code}
\`\`\`

리뷰를 한국어로 작성해주세요.`

// 코드 리뷰 프롬프트 등록
const codeReviewArgsSchema = {
    code: z.string().describe('리뷰할 코드')
}

server.registerPrompt(
    'code-review',
    {
        title: '코드 리뷰',
        description:
            '제공된 코드를 분석하고 리뷰하여 코드 품질, 버그, 성능, 보안, 개선 제안을 제공합니다.',
        argsSchema: codeReviewArgsSchema
    },
    async ({ code }) => {
        const prompt = codeReviewPromptTemplate.replace('{code}', code)

        return {
            messages: [
                {
                    role: 'user' as const,
                    content: {
                        type: 'text' as const,
                        text: prompt
                    }
                }
            ]
        }
    }
)

server
    .connect(new StdioServerTransport())
    .catch(console.error)
    .then(() => {
        // MCP 서버는 stdout을 JSON-RPC 통신에 사용하므로 console.log 대신 stderr 사용
        console.error('MCP server started')
    })
