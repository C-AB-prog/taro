import '../styles.css'
import { useEffect } from 'react'
import Head from 'next/head'

export default function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Загружаем скрипты динамически
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = src
        script.onload = resolve
        script.onerror = reject
        document.body.appendChild(script)
      })
    }

    // Загружаем необходимые скрипты
    const loadScripts = async () => {
      try {
        await loadScript('/cards-data.js')
        await loadScript('/app.js')
      } catch (error) {
        console.error('Error loading scripts:', error)
      }
    }

    loadScripts()
  }, [])

  return (
    <>
      <Head>
        <title>ТАRO</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
        <script src="https://telegram.org/js/telegram-web-app.js" async></script>
      </Head>
      <Component {...pageProps} />
    </>
  )
}
