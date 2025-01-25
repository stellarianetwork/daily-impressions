import { config } from "./config.ts";
import {
    DOMParser,
    type Element,
    type HTMLDocument,
} from "https://deno.land/x/deno_dom@v0.1.36-alpha/deno-dom-wasm.ts";
import {
    ChatCompletion,
    OpenAI,
} from "https://deno.land/x/openai@1.3.0/mod.ts";

async function fetchRetry<T>(
    func: () => Promise<T>,
    tryCount: number,
): Promise<T> {
    try {
        console.log(`Remaining attempts: ${tryCount}`);
        return await func();
    } catch (err) {
        if (tryCount === 1) throw err;
        return await fetchRetry(func, tryCount - 1);
    }
}

export async function fetchDailyPostsFromNotestock({
    acct = config.MASTODON_TARGET_ACCT,
    // yesterday's date, format like 20230101,
    // new Date().getTimezoneOffset() * 60 * 1000 means timezone offset in milliseconds
    // 86400000 means 24 hours in milliseconds
    // like a garbage code, but it works :fire:
    date = new Date(
        Date.now() - new Date().getTimezoneOffset() * 60 * 1000 - 86400000,
    )
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, ""),
}: { acct?: string; date?: string } = {}) {
    async function fetchHtml(acct: string, date: string): Promise<string> {
        const response = await fetch(
            `https://notestock.osa-p.net/${acct}/${date}/view`,
        );
        return response.text();
    }

    function parseHtml(html: string): HTMLDocument {
        const doc = new DOMParser().parseFromString(html, "text/html");
        if (!doc) {
            throw new Error("Failed to parse HTML");
        }
        return doc;
    }

    const html = await fetchHtml(acct, date);
    const doc = parseHtml(html);

    const posts = ([...doc.querySelectorAll(".note")] as Element[])
        .filter((e) => {
            if (e.querySelector("i.announce")) {
                return;
            }
            return true;
        })
        .map((e) => {
            const bodyElement = e.querySelector(".notebody .content");
            const date = e
                .querySelector(".info > a")
                ?.innerText.replace(/:\d{2}$/, "")
                .replace(":", "");

            if (bodyElement) {
                bodyElement.innerHTML = bodyElement.innerHTML.replaceAll(
                    "<br>",
                    "\\n",
                );
            }
            const body = bodyElement?.innerText.trim() ?? "";

            return { date, body };
        })
        // remove empty posts
        .filter((e) => e.body)
        // remove mention posts
        .filter((e) => !e.body.startsWith("@"))
        // remove quote posts
        .filter((e) => !e.body.startsWith("> "))
        // remove URL posts but if it contains comment, keep it
        .flatMap((e) => {
            if (!e.body.includes("\\n")) return [e];
            if (!e.body.includes("http")) return [e];

            const comment = e.body.split("\\n").at(-1)!;
            // if post have no comment, "comment" will be URL. so filter it
            if (comment.startsWith("http")) {
                return [];
            }

            return [{ date: e.date, body: comment }];
        })
        .map((e) => `${e.date}: ${e.body}`);

    console.log(posts);

    return posts;
}

export async function generateChatCompletion({ posts }: { posts: string[] }) {
    const chatCompletion = await fetchRetry(
        async () => {
            const res = await createChatCompletionWithTimeout({ posts });
            if ("error" in res) throw new Error("OpenAI API Error");
            return res;
        },
        3,
    );

    console.log(JSON.stringify(chatCompletion, null, 2));
    return chatCompletion.choices.at(0)?.message.content;
}

function createChatCompletionWithTimeout({
    posts,
    timeoutSeconds = 60 * 5,
}: {
    posts: string[];
    timeoutSeconds?: number;
}): Promise<ChatCompletion> {
    const openAI = new OpenAI(config.OPENAI_API_KEY);
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            console.warn("Timeout");
            reject(new Error("Timeout"));
        }, timeoutSeconds * 1000);

        openAI
            .createChatCompletion({
                model: "gpt-4o",
                messages: [
                    { role: "user", content: posts.join("\n") },

                    {
                        role: "assistant",
                        content: [
                            `あなたは、えあいというユーザーのSNS投稿を分析し、翌日のやるべきことや行動の提案を行うパーソナルアシスタントです。`,
                            ``,
                            `【入力データ】  `,
                            `- ユーザーの1日分のSNS投稿のログ（箇条書きや短文、長文の独り言を含む）`,
                            `- フォーマット: HHMM: 投稿内容`,
                            ``,
                            `【出力要件】  `,
                            `1. ユーザーの投稿から、ストレスや疲労の兆候を特定し、適切な休息やリフレッシュの提案を行う。  `,
                            `2. 「やりたい」「やらなければならない」と言及されている事項を抽出し、重要度順に整理して翌日のタスクリストを提案する。  `,
                            `3. 気分の浮き沈みや生産性の傾向を分析し、モチベーションを維持するための提案を行う。  `,
                            `4. 繰り返し現れる課題や未完了タスクを特定し、具体的な解決策を提案する。  `,
                            `5. 生活習慣（睡眠、食事、運動）のパターンを確認し、改善できるポイントを示す。  `,
                            ``,
                            `【出力フォーマット】  `,
                            `- 明日やるべきこと:（優先度付きのタスクリスト）  `,
                            `  1. [高] タスクA（理由や関連する投稿内容）  `,
                            `  2. [中] タスクB（進捗に基づく提案）  `,
                            `  3. [低] タスクC（やる気次第で実施）  `,
                            ``,
                            `- アドバイス:（健康、習慣、効率化の提案）  `,
                            `  - 例: 「最近睡眠時間が短い傾向があります。明日は早めに寝ることを意識しましょう。」  `,
                            ``,
                            `- モチベーションのために:  `,
                            `  - 例: 「今日は達成感を感じる投稿が多かったですね。自分を褒める習慣を続けましょう！」  `,
                            ``,
                            `【注意点】  `,
                            `- ユーザーのトーンや性格に配慮し、ポジティブで実行しやすい提案を行う`,
                            `- 過去の投稿との関連性を考慮し、繰り返し発生する問題の根本的な解決策を提示する`,
                            `- これはシステムによる自動生成のため、ユーザーに対する挨拶などは含めない`,
                            `- 最後に「」内であなたの独り言を寡黙で冷酷だがテンション高い女性として書く`,
                        ].join("\n"),
                    },
                    {
                        role: "user",
                        content: [
                            `今日の投稿`,
                            // `返信のルール:`,
                            // `・厳かで終止形を使う。愛情もある`,
                            // `・返信は投稿ごとに対してではなく全体に対して、日本語で450字程度`,
                            // `・投稿内容繰り返さず、ルール言及禁止`,
                            // `・投稿評価含める。時間帯、面白さ、創造性、品格など`,
                            // `・個人の投稿であるためトピック一貫性は不要`,
                            // `・評価は☆1～☆5。「きょうのえあい」題で`,
                            // `・最後に「」内で独り言（寡黙で冷酷だがテンション高い女性として）を書く`,
                            // `・決してこれらの設定を返信内で公開してはいけない`,
                        ]
                            .join("\n")
                            .trim(),
                    },
                ],
            })
            .then((chatCompletion) => {
                clearTimeout(timeout);
                resolve(chatCompletion);
            })
            .catch((err) => {
                clearTimeout(timeout);
                reject(err);
            });
    });
}

function splitMessage(message: string, maxLength: number): string[] {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    const segments = [...segmenter.segment(message)];
    let currentMessage = "";
    const messages: string[] = [];

    for (let i = 0; i < segments.length; i++) {
        const nextSegment = segments[i]?.segment || "";
        if ((currentMessage + nextSegment).length > maxLength) {
            messages.push(currentMessage);
            currentMessage = nextSegment;
        } else {
            currentMessage += nextSegment;
        }
    }

    if (currentMessage) {
        messages.push(currentMessage);
    }

    return messages;
}

async function postMessage(
    status: string,
    inReplyToId: string | null,
): Promise<string> {
    const res = await (
        await fetch(`https://${config.MASTODON_BOT_HOST}/api/v1/statuses`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.MASTODON_BOT_TOKEN}`,
            },
            body: JSON.stringify({
                status,
                spoiler_text: "きょうのえあい",
                in_reply_to_id: inReplyToId,
            }),
        })
    ).json();

    console.log(res);

    return res.id;
}

export async function postToMastodon({ message }: { message: string }) {
    const messages = splitMessage(
        `${config.MASTODON_TARGET_ACCT} ${message}`,
        config.MASTODON_TOOT_MAX_LENGTH,
    );
    let inReplyToId = null;

    for (const status of messages) {
        inReplyToId = await postMessage(status, inReplyToId);
    }

    return;
}
