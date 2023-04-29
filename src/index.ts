import {
    fetchDailyPostsFromNotestock,
    generateChatCompletion,
    postToMastodon,
} from "./network.ts";

try {
    console.log("Try to fetch posts from notestock...");
    const posts = await fetchDailyPostsFromNotestock();
    console.log("Fetched posts from notestock.", `${posts.length} posts.`);

    console.log("Try to generate chat completion...");
    const chatCompletion = await generateChatCompletion({ posts });
    if (typeof chatCompletion !== "string") {
        throw new Error("chatCompletion is empty.");
    }

    console.log("Try to post to mastodon...");
    await postToMastodon({ message: chatCompletion });

    console.log("Successfully posted to mastodon.");
} catch (error) {
    console.error(error);
    await postToMastodon({
        message: [
            "きょうのえあいの作成中にエラーがおきました: ",
            "https://github.com/stellarianetwork/daily-impressions/actions",
        ].join("\n"),
    });
}
