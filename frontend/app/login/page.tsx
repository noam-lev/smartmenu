import LoginButton from "../../components/auth/LoginButton";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
  }>;
};

function normalizeNextPath(nextParam: string | string[] | undefined): string {
  const rawNext = Array.isArray(nextParam) ? nextParam[0] : nextParam;
  if (!rawNext || !rawNext.startsWith("/")) {
    return "/";
  }
  return rawNext;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const nextPath = normalizeNextPath(next);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-bold text-zinc-900">Admin Login</h1>
        <p className="mt-2 text-sm text-zinc-600">Use your Google account to access restaurant admin tools.</p>
        <div className="mt-6 flex justify-center">
          <LoginButton nextPath={nextPath} />
        </div>
      </div>
    </main>
  );
}

