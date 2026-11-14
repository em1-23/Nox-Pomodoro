const questions = [
  {
    question: "What is Nox Pomodoro?",
    answer: "Nox Pomodoro is a free online Pomodoro timer and study planner. It combines focus sessions, automatic breaks, task progress, notes, YouTube study videos, and local PDF viewing in one page.",
  },
  {
    question: "How does the Pomodoro timer work?",
    answer: "Choose a work-session length, add tasks with the number of sessions they need, and start the timer. Nox Pomodoro moves between work sessions and short or long breaks according to your settings.",
  },
  {
    question: "Are my tasks, notes, and PDFs uploaded?",
    answer: "Tasks and notes stay in this browser's local storage, and PDF files stay in local browser storage on this device. They are not uploaded to the Nox Pomodoro app server. Embedded YouTube videos still require an internet connection.",
  },
]

function SeoContent() {
  return (
    <section aria-labelledby="about-pomodoro-title" className="Section SeoContent">
      <header>
        <h2 id="about-pomodoro-title">Free Online Pomodoro Timer for Focus and Study</h2>
        <p>
          Nox Pomodoro is a free online focus timer and study planner for
          students and anyone organizing focused work. Set custom Pomodoro
          work and break intervals, track tasks by focus sessions, and keep
          study notes and PDF resources together on your device.
        </p>
      </header>

      <div className="SeoFeatures">
        <article>
          <h3>Focus sessions and automatic breaks</h3>
          <p>
            Run a Pomodoro work timer, take short breaks, and move to a long
            break after the number of work sessions you choose. Adjust each
            session to fit your study or work routine.
          </p>
        </article>
        <article>
          <h3>Task planner with session estimates</h3>
          <p>
            Add tasks and estimate how many focus sessions each one needs.
            Track completed sessions and see the estimated time for your task
            list.
          </p>
        </article>
        <article>
          <h3>Private study notes and resources</h3>
          <p>
            Link YouTube study videos to a task, write notes, and preview PDF
            files in the browser. Notes and PDFs stay in local browser storage
            on your device.
          </p>
        </article>
      </div>

      <article aria-labelledby="nox-focus-flow-title" className="SeoMethod">
        <h3 id="nox-focus-flow-title">Nox Focus Flow: Focus, Organize, eXecute</h3>
        <p>
          Nox Focus Flow is the simple routine behind the planner: focus with a
          customizable Pomodoro timer, organize work into tasks and sessions,
          then execute one session at a time. Use it as a study timer, work
          timer, or lightweight daily focus planner.
        </p>
      </article>

      <div aria-labelledby="pomodoro-faq-title" className="SeoFaq">
        <h3 id="pomodoro-faq-title">Pomodoro Timer FAQ</h3>
        {questions.map(({ question, answer }) => (
          <article key={question}>
            <h4>{question}</h4>
            <p>{answer}</p>
          </article>
        ))}
      </div>

      <div aria-label="ملخص مؤقّت بومودورو بالعربية" className="SeoArabic">
        <h3>مؤقّت بومودورو لتنظيم التركيز والمهام</h3>
        <p>
          Nox Pomodoro مؤقّت تركيز ومخطط دراسة مجاني على الإنترنت. خصّص مدة
          جلسات بومودورو والاستراحات، ونظّم مهامك حسب جلسات التركيز، وتابع
          إنجازك اليومي. احفظ ملاحظات الدراسة واعرض ملفات PDF على جهازك؛ لا
          تُرفع هذه البيانات إلى خادم التطبيق. Nox Focus Flow: ركّز، نظّم،
          وأنجز جلسة واحدة في كل مرة.
        </p>
      </div>
    </section>
  )
}

export default SeoContent
