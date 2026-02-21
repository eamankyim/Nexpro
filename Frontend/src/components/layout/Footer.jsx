const Footer = () => {
  return (
    <footer className="border-t border-border bg-card mt-auto py-4 px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
        <p className="text-xs text-muted-foreground text-center md:text-left">
          &copy; {new Date().getFullYear()} ShopWISE. All rights reserved.
        </p>
        <p className="text-xs text-muted-foreground text-center md:text-right">
          Powered by iCreations Business Intelligence Systems (iBIS)
        </p>
      </div>
    </footer>
  );
};

export default Footer;
