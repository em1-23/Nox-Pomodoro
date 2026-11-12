import FirstSection from "./HomePages/FirstSection"
import Footer from "./HomePages/Footer"
import Header from "./HomePages/Header"
import ListSection from "./HomePages/ListSection"
import SourceSection from "./HomePages/SourceSection"

function Home() {
  return (
    <>
      <Header />
      <FirstSection />
      <ListSection />
      <SourceSection />
      <Footer />
    </>
  )
}

export default Home