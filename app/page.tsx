import Navbar from "./components/Navbar"
import { Button } from "./components/ui/button";
import "./globals.css"

export default async function Home() {
  return (
    <div>
      <div className="w-full max-w-5xl min-h-screen mx-auto px-4 py-4 md:px-8 md:pb-10">
        <Navbar />
        <main>
          <section
            className="grid content-center gap-4 min-h-[calc(100vh-92px)] animate-[rise_0.32s_ease] md:grid-cols-[minmax(0,1fr)_360px] md:items-center"
            aria-label="Intro"
          >
            <div className="max-w-2xl pt-16 pb-5">
              <p className="mb-3 text-secondary text-xs font-extrabold tracking-widest uppercase">
                AI buying decision
              </p>
              <h1 className="text-5xl md:text-7xl xl:text-8xl leading-none font-bold tracking-tight m-0">
                Should I buy this?
              </h1>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-sm">
                Upload what you want. DECIDE gives one clear answer.
              </p>
              <Button
                className="mt-7 min-h-[52px] px-4 rounded-2xl font-bold bg-secondary text-secondary-foreground shadow-lg cursor-pointer border-0"
              >
                Start
              </Button>
            </div>

            <div className="md:justify-self-end max-w-xs min-h-[92px] flex items-center gap-3 p-4 bg-card border border-border rounded-3xl shadow-2xl">
              <span className="w-3 h-3 rounded-full bg-accent shrink-0 shadow-lg" />
              <div>
                <small className="block text-muted-foreground mb-1">Example verdict</small>
                <strong className="text-2xl text-accent">Buy · 87%</strong>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
