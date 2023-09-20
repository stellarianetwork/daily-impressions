import "https://deno.land/std@0.180.0/dotenv/load.ts";

function checkKeys<T>(o: { [K in keyof T]: T[K] | null | undefined }): {
    [K in keyof T]: NonNullable<T[K]>;
} {
    const newObj: Partial<{ [K in keyof T]: NonNullable<T[K]> }> = {};
    for (const key in o) {
        const value = o[key];
        if (value === null || value === undefined) {
            throw new Error(`Environment variable ${key} is not set`);
        }
        newObj[key] = value;
    }
    return newObj as { [K in keyof T]: NonNullable<T[K]> };
}

const configKeyValue = checkKeys({
    OPENAI_API_KEY: Deno.env.get("OPENAI_API_KEY"),
    MASTODON_TOOT_MAX_LENGTH: Deno.env.get("MASTODON_TOOT_MAX_LENGTH"),
    MASTODON_TARGET_ACCT: Deno.env.get("MASTODON_TARGET_ACCT"),
    MASTODON_BOT_HOST: Deno.env.get("MASTODON_BOT_HOST"),
    MASTODON_BOT_TOKEN: Deno.env.get("MASTODON_BOT_TOKEN"),
});

export const config = {
    ...configKeyValue,
    MASTODON_TOOT_MAX_LENGTH: Number(configKeyValue.MASTODON_TOOT_MAX_LENGTH),
} as const;
