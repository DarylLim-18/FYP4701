import Link from 'next/link'

export default function NavItem({ href, icon, label, isActive, isCollapsed }) {
  return (
    <Link
      href={href}
      className={`flex items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 group ${
        isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
      }`}
    >
      <div className="w-6 h-6">{icon}</div>
      {!isCollapsed && (
        <span className="ms-3 transition-all duration-200">{label}</span>
      )}
    </Link>
  )
}