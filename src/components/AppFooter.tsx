export function AppFooter() {
  return (
    <div className="border-t border-border/60 px-4 py-3 text-center">
      <p className="text-[10px] text-muted-foreground/40">
        Made by{" "}
        <a
          href="http://emirerkan.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground/60 underline-offset-2 hover:underline hover:text-muted-foreground transition-colors"
        >
          emirerkan.com
        </a>
      </p>
    </div>
  );
}
