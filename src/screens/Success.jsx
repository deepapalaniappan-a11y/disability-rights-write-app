export default function SuccessScreen({ author, title, offline, onNewStory, onLogout }) {
  return (
    <div style={{
      minHeight: '100vh',
      minHeight: '100dvh',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }}>
      <main
        role="main"
        aria-label="Story published successfully"
        style={{
          maxWidth: 480,
          margin: '0 auto',
          padding: '40px 24px',
          textAlign: 'center',
          width: '100%'
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 16 }} aria-hidden="true">🎉</div>
        <h1 style={{
          fontFamily: "'Source Serif 4', Georgia, serif",
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#1a1a1a',
          margin: '0 0 8px 0'
        }}>
          {offline ? 'Story Saved!' : 'Story Published!'}
        </h1>
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '1rem',
          color: '#555',
          lineHeight: 1.6,
          margin: '0 0 24px 0'
        }}>
          <strong>"{title}"</strong>
          <br />by {author.name}
          <br />{offline
            ? 'has been saved and will publish when you are back online.'
            : 'has been sent for review.'}
        </p>

        <div style={{
          background: offline ? '#fffbeb' : '#f0fdf4',
          borderRadius: 12,
          padding: 20,
          border: `1px solid ${offline ? '#fde68a' : '#bbf7d0'}`,
          marginBottom: 24,
          textAlign: 'left'
        }}>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.9rem',
            color: offline ? '#92400e' : '#166534',
            margin: 0,
            lineHeight: 1.8
          }}>
            {offline ? (
              <>
                ✅ Story saved on your phone
                <br />⏳ Will publish automatically when connected
                <br />💡 Keep the app open or check back later
              </>
            ) : (
              <>
                ✅ Submitted with your name as author
                <br />✅ The coordinator will review and add categories
                <br />✅ You will see it on the Stories page once published
                <br />✅ Share the link with your network!
              </>
            )}
          </p>
        </div>

        <button
          onClick={onNewStory}
          style={{
            width: '100%',
            padding: '16px',
            fontSize: '1.05rem',
            fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            background: '#1a1a1a',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
            marginBottom: 12,
            minHeight: 52
          }}
        >
          ✍️ Write Another Story
        </button>

        <button
          onClick={onLogout}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '0.95rem',
            fontWeight: 500,
            fontFamily: "'DM Sans', sans-serif",
            background: 'none',
            color: '#666',
            border: '1px solid #ddd',
            borderRadius: 10,
            cursor: 'pointer',
            minHeight: 48
          }}
        >
          Sign Out
        </button>
      </main>
    </div>
  );
}
