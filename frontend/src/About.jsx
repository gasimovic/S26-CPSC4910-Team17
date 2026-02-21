import React from 'react';

export default function About() {
    return (
        <div style={styles.container}>
            <h1 style={styles.pageTitle}>About Page</h1>
            <div style={styles.card}>
                <p style={styles.description}>About Page Work In Progress</p>
            </div>
        </div>
    );
}

const styles = {
    container: {
        maxWidth: '800px',
        margin: '40px auto',
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
    pageTitle: {
        textAlign: 'center',
        marginBottom: '30px',
        color: '#333',
        fontWeight: '300',
        fontSize: '2.5rem',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        padding: '40px',
        textAlign: 'center',
    },
    description: {
        fontSize: '1.2rem',
        color: '#666',
    },
};
