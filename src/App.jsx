import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createHashRouter, RouterProvider, Outlet, Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "./Productivitycontext";
import { useAuth } from "./hooks/useAuth";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Icon from "./components/Icon.jsx";
import "./design-system.css";

const BidList = lazy(() => import("./pages/BidList.jsx"));
const BidDetail = lazy(() => import("./pages/BidDetail.jsx"));
const ProTool = lazy(() => import("./pages/ProTool.jsx"));
const Factors = lazy(() => import("./pages/Factors.jsx"));
const ProductivityAnalysis = lazy(() => import("./pages/ProductivityAnalysis.jsx"));
const ProductivityLossList = lazy(() => import("./pages/Productivitylosslist.jsx"));

const protectedPage = page => <ProtectedRoute>{page}</ProtectedRoute>;
// A stable data router lets editors block SPA links and browser history changes.
// Authentication stays inside the router and above every existing page.
const router = createHashRouter([{
  path: "/",
  element: <AuthProvider><AppContent /></AuthProvider>,
  children: [
    { index: true, element: protectedPage(<Home />) },
    { path: "login", element: <Login /> },
    { path: "bid", element: protectedPage(<BidList />) },
    { path: "bid/new", element: protectedPage(<BidDetail />) },
    { path: "bid/:id", element: protectedPage(<BidDetail />) },
    { path: "pro", element: protectedPage(<ProTool />) },
    { path: "factors", element: protectedPage(<Factors />) },
    { path: "productivity-analysis", element: protectedPage(<ProductivityAnalysis />) },
    { path: "proactive", element: protectedPage(<ProductivityAnalysis />) },
    { path: "retroactive", element: protectedPage(<ProductivityAnalysis />) },
    { path: "productivity-losses", element: protectedPage(<ProductivityLossList />) },
    { path: "*", element: <div className="hcg-not-found"><span className="hcg-eyebrow">Page not found</span><h1>Let’s find your way back.</h1><Link className="hcg-button" to="/">Return to workspace<Icon name="arrow-right" /></Link></div> },
  ],
}]);

export default function App() {
  return <RouterProvider router={router} />;
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const menuTrigger = useRef(null);
  const publicPage = location.pathname === "/" || location.pathname === "/login";
  const isLogin = location.pathname === "/login";
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;
    const outside = event => { if (!menuRef.current?.contains(event.target)) setMenuOpen(false); };
    const escape = event => { if (event.key === "Escape") { setMenuOpen(false); menuTrigger.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [menuOpen]);

  const handleLogout = () => {
    const request = new Event("hcg-before-signout", { cancelable: true });
    if (!window.dispatchEvent(request)) return;
    logout();
    closeMenu();
    navigate("/login");
  };

  return (
    <div className={`hcg-app ${publicPage ? "hcg-public" : "hcg-tools"} ${isLogin ? "hcg-auth-page" : ""}`}>
      <a className="hcg-skip" href="#hcg-main" onClick={event => {event.preventDefault(); document.getElementById("hcg-main")?.focus();}}>Skip to content</a>
      <header className="hcg-site-header">
        <Link className="hcg-brand" to="/" onClick={closeMenu} aria-label="HCG WAY home"><span className="hcg-brand-name">HCG WAY<span className="hcg-brand-dot" /></span><span className="hcg-brand-caption">Engineering intelligence</span></Link>
        <nav className="hcg-site-nav" aria-label="Main navigation">
          {user && <NavLink className="hcg-overview-link" to="/" end onClick={closeMenu}>Workspace</NavLink>}
          {user ? <div className="hcg-account" ref={menuRef}>
            <button className="hcg-account-trigger" ref={menuTrigger} type="button" aria-expanded={menuOpen} aria-controls="hcg-account-links" onClick={() => setMenuOpen(!menuOpen)}><span className="hcg-avatar">{(user.username || "U").slice(0,1).toUpperCase()}</span><span className="hcg-account-name">{user.username}</span><Icon name="chevron" size={14} /></button>
            {menuOpen && <div id="hcg-account-links" className="hcg-account-links"><div className="hcg-account-summary"><strong>{user.username}</strong><span>{user.email}</span></div><Link to="/bid" onClick={closeMenu}>Bid assessments<Icon name="arrow-up-right" size={15} /></Link><Link to="/productivity-losses" onClick={closeMenu}>Productivity projects<Icon name="arrow-up-right" size={15} /></Link><button type="button" onClick={handleLogout}>Sign out<Icon name="logout" size={15} /></button></div>}
          </div> : !isLogin && <Link to="/login" className="hcg-nav-signin" onClick={closeMenu}>Sign in<Icon name="arrow-right" size={15} /></Link>}
        </nav>
      </header>
      <main id="hcg-main" className="hcg-main" tabIndex={-1}>
        <Suspense fallback={<div className="hcg-route-loader" role="status"><span className="hcg-route-spinner" /><p>Opening your workspace…</p></div>}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="hcg-site-footer"><span>© {new Date().getFullYear()} HCG WAY</span><span>Civil & Environmental Engineering<span className="hcg-footer-separator"> / </span>UW–Madison</span></footer>
    </div>
  );
}
