import { signOutAction } from "@/app/actions/auth"

export function SignOutButton({
  label = "Sign out",
  className = "",
}: {
  label?: string
  className?: string
}) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  )
}
