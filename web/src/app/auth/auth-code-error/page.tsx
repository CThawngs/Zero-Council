export default async function AuthCodeError({ searchParams }: { searchParams: Promise<{ code?: string; message?: string }> }) {
    const { code, message } = await searchParams

    return (
        <div className="p-6">
        <h1 className="text-xl font-bold text-red-600">Authentication Error</h1>
        <p>Error Code: {code ?? 'Unknown'}</p>
        {message && <p>Details: {decodeURIComponent(message)}</p>}
        </div>
    )
}