import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";

/** 受保护的后台外壳：校验登录态，渲染侧边栏 + 内容区。 */
export default async function DashboardAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/dashboard/login");

  return (
    <div className="flex min-h-screen bg-mist">
      <DashboardSidebar email={user.email ?? ""} />
      <main className="flex-1 px-5 py-8 md:px-10">{children}</main>
    </div>
  );
}
