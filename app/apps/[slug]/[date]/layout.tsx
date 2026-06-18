// Mirrors the [slug] layout one level down so historical captures get the same
// intercepting-route modal behavior over their dated gallery.
export default function AppDateLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
