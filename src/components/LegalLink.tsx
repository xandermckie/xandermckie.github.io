interface LegalLinkProps {
  href: string;
  children: string;
}

export default function LegalLink({ href, children }: LegalLinkProps) {
  return (
    <a href={href} className="text-accent underline-offset-2 hover:underline">
      {children}
    </a>
  );
}
