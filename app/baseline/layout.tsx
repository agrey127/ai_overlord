import BottomNav from "../../components/navigation/BottomNav";

export default function BaselineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <BottomNav />
    </>
  );
}
