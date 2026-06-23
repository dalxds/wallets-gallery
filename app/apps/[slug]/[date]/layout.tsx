// Hosts the parallel @modal slot alongside a capture's dated gallery: a tile
// click navigates to a screen/flow route that the slot's intercepting routes
// render as a modal over {children}; a direct/refreshed visit renders the full
// standalone page instead.
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
