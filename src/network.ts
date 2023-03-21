import config from "./config.ts";
import {
    DOMParser,
    type Element,
} from "https://deno.land/x/deno_dom@v0.1.36-alpha/deno-dom-wasm.ts";
import { OpenAI } from "https://deno.land/x/openai@1.3.0/mod.ts";

export async function fetchDailyPostsFromNotestock({
    acct = config.TARGET_ACCT,
    // yesterday's date, format like 20230101,
    // new Date().getTimezoneOffset() * 60 * 1000 means timezone offset in milliseconds
    // 86400000 means 24 hours in milliseconds
    // like a garbage code, but it works :fire:
    date = new Date(
        Date.now() - new Date().getTimezoneOffset() * 60 * 1000 - 86400000
    )
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, ""),
}: { acct?: string; date?: string } = {}) {
    const html = await (
        await fetch(`https://notestock.osa-p.net/${acct}/${date}/view`)
    ).text();

    const doc = new DOMParser().parseFromString(html, "text/html");
    if (!doc) {
        throw new Error("Failed to parse HTML");
    }

    const posts = ([...doc.querySelectorAll(".note")] as Element[])
        .filter((e) => {
            if (e.querySelector("i.announce")) {
                return;
            }
            return true;
        })
        .map((e) => {
            const date = e
                .querySelector(".info > a")
                ?.innerText.replace(/:\d{2}$/, "")
                .replace(":", "");
            const body =
                e
                    .querySelector(".notebody .content")
                    ?.innerText.replaceAll("\n", "\\n")
                    .trim() ?? "";
            return { date, body };
        })
        // remove empty posts
        .filter((e) => e.body)
        // remove mention posts
        .filter((e) => !e.body.startsWith("@"))
        // remove quote posts
        .filter((e) => !e.body.startsWith("> "))
        .map((e) => `${e.date}: ${e.body}`);

    console.log(posts);

    return posts;
}

export async function generateChatCompletion({ posts }: { posts: string[] }) {
    const openAI = new OpenAI(config.OPENAI_API_KEY);
    const systemInitMessage = `
あなたにはえあいという人物のSNSでのある日の投稿の感想文を作成してもらいます。
ルール
・あなたは厳かな人間で終止形を好む。彼に対する愛情も持ち合わせている
・このメッセージの後、いくつかのメッセージで区切って投稿を送る。メッセージを受信し終わるまでは「OK」以外の返答をしないこと
・投稿のフォーマットは「時間(hhmm): 投稿内容」
・投稿の中にURLが含まれることがある。その場合はURLの後が彼のコメントである。URLの前はドキュメントタイトルであるため彼のコメントとして扱わないこと
・「以上です。」が末尾にあるメッセージを受け取ったらメッセージは終了、返答を送信すること。まだ終了していない場合は「OK」以外の返答をしてはいけない
・返答は日本語で、300文字程度で作成すること。絶対に450文字を超えてはいけない
・返答のなかで投稿の内容を繰り返さないこと
・投稿の評価を含める。投稿の時間帯、面白いか、創造的か、品格があるかなどあらゆる観点が有効
・全体的な評価を含める。「きょうのえあい」という題で、評価は☆1から☆5の5段階
・最後にあなた（寡黙で冷酷だがテンション高い女性）のコメントを独り言としてセリフ口調で含めること。それは「」で囲うこと
    `.trim();
    const chatCompletion = await openAI.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
            { role: "system", content: systemInitMessage },
            { role: "user", content: posts.join("\n") },
            { role: "assistant", content: "OK" },
            { role: "user", content: "以上です。" },
        ],
    });
    console.log(JSON.stringify(chatCompletion, null, 2));
    return chatCompletion.choices.at(0)?.message.content;
}

export async function postToMastodon({ message }: { message: string }) {
    const res = await (
        await fetch(`https://${config.MASTODON_BOT_HOST}/api/v1/statuses`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.MASTODON_BOT_TOKEN}`,
            },
            body: JSON.stringify({
                status: `${config.TARGET_ACCT} ${message}`.trim(),
                spoiler_text: "きょうのえあい",
            }),
        })
    ).json();
    console.log(res);

    return;
}
