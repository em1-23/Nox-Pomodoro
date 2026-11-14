import FirstSection from "./HomePages/FirstSection"
import Footer from "./HomePages/Footer"
import Header from "./HomePages/Header"
import ListSection from "./HomePages/ListSection"
import SeoContent from "./HomePages/SeoContent"
import SourceSection from "./HomePages/SourceSection"

function Home() {
  return (
    <>
      <Header />
      <FirstSection />
      <ListSection />
      <SourceSection />
      <SeoContent />
      <Footer />
    </>
  )
}

export default Home