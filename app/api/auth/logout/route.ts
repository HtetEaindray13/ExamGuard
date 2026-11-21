import { clearAuthSession, safeReturnTo } from "../../../auth";

export async function GET(request: Request) {
  await clearAuthSession();
  const returnTo = safeReturnTo(new URL(request.url).searchParams.get("returnTo"));
  return Response.redirect(new URL(returnTo, request.url), 303);
}
