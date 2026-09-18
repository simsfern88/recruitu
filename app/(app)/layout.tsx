import { requireUser } from "@/lib/auth";
import { Nav } from "@/components/nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <>
      <Nav email={user.email} />
      <main className="shell" style={{ paddingTop: 32, paddingBottom: 80 }}>
        {children}
      </main>
    </>
  );
}
