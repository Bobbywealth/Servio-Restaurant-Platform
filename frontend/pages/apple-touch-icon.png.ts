import type { GetServerSideProps } from 'next';

/**
 * iOS/Safari will probe for this icon automatically.
 * Return 204 to prevent repeated 404 noise in hosting request logs.
 */
export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  res.statusCode = 204;
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.end();
  return { props: {} };
};

export default function AppleTouchIcon() {
  return null;
}

