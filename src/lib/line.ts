export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl: string;
}

/**
 * 用 LINE access token 取得使用者 profile
 * https://developers.line.biz/en/reference/line-login/#get-user-profile
 */
export async function getLineProfile(accessToken: string): Promise<LineProfile | null> {
  if (!accessToken) return null;

  try {
    const res = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) return null;

    const profile = await res.json();
    if (!profile.userId) return null;

    return {
      userId: profile.userId,
      displayName: profile.displayName || "",
      pictureUrl: profile.pictureUrl || "",
    };
  } catch {
    return null;
  }
}
