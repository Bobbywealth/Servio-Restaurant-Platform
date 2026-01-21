import type { GetServerSideProps } from 'next';

/**
 * Avoid noisy 404s from browsers requesting /favicon.ico.
 * We intentionally respond with 204 (No Content) instead of shipping a binary .ico.
 */
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.statusCode = 204;
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.end();
  return { props: {} };
};

export default function Favicon() {
  return null;
}

