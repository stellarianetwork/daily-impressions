import { parse } from "./deps.ts";
import {
    fetchDailyPostsFromNotestock,
    generateChatCompletion,
    postToMastodon,
} from "./network.ts";

const parsedArgs = parse(Deno.args);
const isDryRun = parsedArgs["dry-run"] === true;

if (isDryRun) {
    console.log("Dry run. May skip posting processes.");
    await new Promise((resolve) => setTimeout(resolve, 5000));
}

try {
    console.log("Try to fetch posts from notestock...");
    const posts = await fetchDailyPostsFromNotestock();
    console.log("Fetched posts from notestock.", `${posts.length} posts.`);

    console.log("Try to generate chat completion...");
    const chatCompletion = await generateChatCompletion({ posts });
    if (typeof chatCompletion !== "string") {
        throw new Error("chatCompletion is empty.");
    }

    if (isDryRun) {
        console.log("Dry run. Skip posting to mastodon.");
        Deno.exit(0);
    }

    console.log("Try to post to mastodon...");
    await postToMastodon({ message: chatCompletion });

    console.log("Successfully posted to mastodon.");
} catch (error) {
    console.error(error);

    if (isDryRun) {
        console.log("Dry run. Skip posting to mastodon.");
        Deno.exit(0);
    }

    await postToMastodon({
        message: [
            "きょうのえあいの作成中にエラーがおきました: ",
            "https://github.com/stellarianetwork/daily-impressions/actions",
        ].join("\n"),
    });
}
