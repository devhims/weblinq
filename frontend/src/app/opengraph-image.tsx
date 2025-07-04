import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Weblinq';
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #1a1a1a, #0f0f0f)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          padding: '40px',
          color: 'white',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <img
            src="https://weblinq.dev/logo2.png"
            alt="WebLinq"
            style={{
              width: '320px',
              height: '180px',
              marginBottom: '1rem',
            }}
          />
          <div
            style={{
              fontSize: '1.5rem',
              color: '#ccc',
              maxWidth: '600px',
              lineHeight: '1.4',
            }}
          >
            Extract data, capture screenshots, and search the internet with our web scraping and browser automation
            platform.
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: '2rem',
              gap: '1rem',
            }}
          >
            <div style={{ fontSize: '1rem', color: '#aaa', display: 'flex' }}>
              <span>weblinq.dev</span>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
