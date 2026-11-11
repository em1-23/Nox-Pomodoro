function Footer() {
  const Array = [
    {id:"linkedin",Link:"https://www.linkedin.com/in/mahmoudahmedelngar01027680112/",Color:"#0a66c2"},
    {id:"github",Link:"https://www.github.com/em1-23",Color:"#f5f5f5"},
    {id:"facebook",Link:"https://www.facebook.com/mahmoud.ahmed.elnagar.331391",Color:"#1877f2"},
    {id:"whatsapp",Link:"https://wa.me/+201027680112",Color:"#25d366"},
    {id:"google",Link:"mailto:melngar650@gmail.com",Color:"#1877f2"}
  ]
  return (
    <div className='Section Footer'>
      <h1>Nox Pomodoro <span style={{fontSize:"25px",color:"red"}}>By Mahmoud Elnagar</span></h1>
      <div className="Portofilio">
        <div className="Social">
          {Array.map((N)=>(
            <a href={N.Link} target="_blank" key={N.id} style={{"--Color":N.Color}}>
              <i className={`fa-brands fa-${N.id}`}></i>
            </a>
          ))}
        </div>
        My Portofilio is <a style={{color:"var(--SpecialColor)"}} href="https://the-n-ox.vercel.app/">the-n-ox.vercel.app/</a>
      </div>
      <span style={{fontFamily:"Head"}}>By NOX</span>
    </div>
  )
}

export default Footer