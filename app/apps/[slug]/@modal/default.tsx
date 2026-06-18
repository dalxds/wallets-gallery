// Required for the parallel slot: on a hard load / refresh of any non-intercepted
// route, the slot renders this (null = no modal) instead of 404ing.
export default function Default() {
  return null
}
