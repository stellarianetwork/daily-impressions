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
await postToMastodon({
    message: chatCompletion ?? "きょうのえあいの作成中にエラーがおきました",
});
console.log("Posted to mastodon.");
