import { Link } from "react-router-dom";
import { useAuth } from "../Productivitycontext";
import Icon from "../components/Icon.jsx";

export default function Home() {
  const { user } = useAuth();
  return <div className="hcg-home">
    <section className="hcg-home-story" aria-labelledby="home-title"><span className="hcg-eyebrow">A considered approach to construction</span><h1 id="home-title">A clearer view.<br />A stronger<br className="hcg-desktop-break" /> decision.</h1><p>Make space for the decisions<br className="hcg-desktop-break" /> that shape your next project.</p><div className="hcg-story-foot"><span className="hcg-short-rule" /><span>Construction. Research. Insight.</span></div></section>
    <section className="hcg-tool-collection" aria-label="Engineering tools">
      <div className="hcg-tool-sheet">
        <article className="hcg-tool-entry"><div className="hcg-tool-label"><span>01</span><span>Project decisions</span></div><h2>To bid,<br />or not to bid?</h2><p>Consider the relationships, risks and readiness behind your next opportunity.</p><Link className="hcg-text-link" to="/bid">{user ? "Open bid assessments" : "Explore bid assessments"}<Icon name="arrow-up-right" size={16} /></Link></article>
        <article className="hcg-tool-entry"><div className="hcg-tool-label"><span>02</span><span>Labor insights</span></div><h2>Understand<br />what shapes the work.</h2><p>A quantified approach to electrical labor productivity. Plan ahead or look back with shared project data.</p><div className="hcg-tool-actions"><Link className="hcg-text-link" to="/productivity-losses">Productivity analysis<Icon name="arrow-up-right" size={16} /></Link><Link className="hcg-secondary-link" to="/factors">Explore the factors<Icon name="arrow-right" size={15} /></Link></div></article>
      </div>
    </section>
  </div>;
}
