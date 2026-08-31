export default function Footer() {
  return (
    <footer className="hair mt-8">
      <div className="max-w-[1120px] mx-auto px-5 md:px-8 py-12">
        <div className="grid md:grid-cols-[1.2fr_1fr_1fr] gap-8">
          <div>
            <div className="text-[15px] font-semibold">CareTwin</div>
            <p className="cap mt-2 max-w-[42ch]">A real-data digital twin for elderly health monitoring. Major project,
              Dept. of Computer Science &amp; Engineering, Dayananda Sagar College of Engineering.</p>
            <p className="cap mt-3">Rudraksha Singh Sengar · Snehal Prakash · Ishaan Saxena<br />Guide: Dr. K. Janani</p>
          </div>
          <div>
            <div className="eyebrow !text-[var(--mute)] mb-3">References</div>
            <ul className="cap space-y-2 list-none p-0">
              <li>Momand et al., &ldquo;Building Digital Twins for Elderly Care,&rdquo; <i>IEEE Access</i> 13, 2025.</li>
              <li>Zhu et al., &ldquo;GAN-Enhanced Multi-Agent DRL&hellip;,&rdquo; <i>IEEE Trans. Consum. Electron.</i> 72(2), 2026.</li>
            </ul>
          </div>
          <div>
            <div className="eyebrow !text-[var(--mute)] mb-3">Links</div>
            <ul className="cap space-y-2 list-none p-0">
              <li><a href="https://github.com/WasThatRudy/caretwin" target="_blank" rel="noreferrer">Source code ↗</a></li>
              <li><a href="https://github.com/mommand/EDT-Datasets" target="_blank" rel="noreferrer">EDT-Datasets ↗</a></li>
            </ul>
          </div>
        </div>
        <div className="cap mt-9 pt-5 hair-soft flex flex-wrap gap-x-4 gap-y-1 justify-between">
          <span>Proof of concept · not a medical device.</span>
          <span className="mono">Next.js · react-three-fiber · PyTorch · scikit-learn</span>
        </div>
      </div>
    </footer>
  );
}
