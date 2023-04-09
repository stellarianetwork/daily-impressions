import {
    fetchDailyPostsFromNotestock,
    generateChatCompletion,
    postToMastodon,
} from "./network.ts";

console.log("Try to fetch posts from notestock...");
const posts = await fetchDailyPostsFromNotestock();
console.log("Fetched posts from notestock.", `${posts.length} posts.`);

console.log("Try to generate chat completion...");
const chatCompletion = await generateChatCompletion({ posts });
console.log("Generated chat completion.", chatCompletion);

console.log("Try to post to mastodon...");
try {
    if (typeof chatCompletion !== "string") {
        throw new Error("chatCompletion is empty.");
    }
    await postToMastodon({ message: chatCompletion });
} catch (error) {
    console.error(error);
    await postToMastodon({
        message: [
            "きょうのえあいの作成中にエラーがおきました: ",
            "https://github.com/stellarianetwork/daily-impressions/actions",
        ].join("\n"),
    });
}
console.log("Posted to mastodon.");
