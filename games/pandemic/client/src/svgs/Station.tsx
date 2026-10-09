import type { SVGProps } from 'react';

export const STATION_WIDTH = 30;
export const STATION_HEIGHT = 28;

export function Station(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 -3 24 23"
      xmlns="http://www.w3.org/2000/svg"
      width={STATION_WIDTH}
      height={STATION_HEIGHT}
      {...props}
    >
      <path d="M2 7 12 12 12 18 2 13Z" fill="#f1f4f7" />
      <path d="M12 12 22 7 22 13 12 18Z" fill="#cbd4dd" />
      <path d="M2 7 12 12 12-2Z" fill="#ffffff" />
      <path d="M12 12 22 7 12-2Z" fill="#e3e9ef" />
      <path d="M15 16.5 18 15 18 11 15 12.5Z" fill="#8493a3" />
      <path d="M5 10.5 8 12 8 14.5 5 13Z" fill="#6fa8dc" />
    </svg>
  );
}
