// pages/index.js
import { useEffect } from 'react'
import Head from 'next/head'

export default function Home() {
  useEffect(() => {
    // Инициализация приложения
    if (typeof window !== 'undefined') {
      // Загрузите app.js как скрипт
      const script = document.createElement('script')
      script.src = '/app.js' // или вставьте код напрямую
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  return (
    <>
      <Head>
        <title>ТАRO</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="/styles.css" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
      </Head>
      
      {/* Контейнер для вашего SPA приложения */}
      <div id="app"></div>
      
      {/* Загрузите cards-data.js */}
      <script src="/cards-data.js"></script>
    </>
  )
}
