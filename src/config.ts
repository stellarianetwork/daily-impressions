import "https://deno.land/std@0.180.0/dotenv/load.ts";

const config = {
    OPENAI_API_KEY: Deno.env.get("OPENAI_API_KEY"),
    TARGET_ACCT: Deno.env.get("TARGET_ACCT"),
    MASTODON_BOT_HOST: Deno.env.get("MASTODON_BOT_HOST"),
    MASTODON_BOT_TOKEN: Deno.env.get("MASTODON_BOT_TOKEN"),
};

(Object.keys(config) as (keyof typeof config)[]).forEach((key) => {
    if (config[key] === undefined) {
        throw new Error(`Environment variable ${key} is not set`);
    }
});

export default Object.freeze(config) as {
    readonly [K in keyof typeof config]: string;
};
