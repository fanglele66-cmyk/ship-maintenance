<script setup>
import { useId } from 'vue'

defineProps({
  kind: { type: String, default: 'cylinder' },
  size: { type: [Number, String], default: 64 },
})

const uid = `engine-part-${useId()}`
const paint = (name) => `url(#${uid}-${name})`
const fragment = (name) => `#${uid}-${name}`
</script>

<template>
  <svg class="engine-part-icon" :width="size" :height="size" viewBox="0 0 128 128" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient :id="`${uid}-steel`" x1=".12" y1="0" x2=".88" y2="1">
        <stop stop-color="#F4F7F7" />
        <stop offset=".19" stop-color="#C8D2D6" />
        <stop offset=".4" stop-color="#87969F" />
        <stop offset=".49" stop-color="#B4C0C6" />
        <stop offset=".71" stop-color="#6A7B85" />
        <stop offset="1" stop-color="#3B4C57" />
      </linearGradient>
      <linearGradient :id="`${uid}-round`" x1="0" y1="0" x2="1" y2="0">
        <stop stop-color="#52646E" />
        <stop offset=".19" stop-color="#9EAEB6" />
        <stop offset=".37" stop-color="#EDF2F3" />
        <stop offset=".53" stop-color="#BAC6CC" />
        <stop offset=".79" stop-color="#70838D" />
        <stop offset="1" stop-color="#40515C" />
      </linearGradient>
      <linearGradient :id="`${uid}-dark`" x1="0" y1="0" x2=".8" y2="1">
        <stop stop-color="#85959D" />
        <stop offset=".23" stop-color="#52646F" />
        <stop offset=".56" stop-color="#354750" />
        <stop offset="1" stop-color="#1D2D37" />
      </linearGradient>
      <linearGradient :id="`${uid}-face`" x1="0" y1="0" x2=".8" y2="1">
        <stop stop-color="#F5F7F7" />
        <stop offset=".45" stop-color="#CDD7DB" />
        <stop offset="1" stop-color="#899AA3" />
      </linearGradient>
      <linearGradient :id="`${uid}-copper`" x1=".08" y1="0" x2=".8" y2="1">
        <stop stop-color="#EDD7A8" />
        <stop offset=".2" stop-color="#CCA875" />
        <stop offset=".43" stop-color="#A77B43" />
        <stop offset=".56" stop-color="#DFC08C" />
        <stop offset=".8" stop-color="#936C3D" />
        <stop offset="1" stop-color="#664B2D" />
      </linearGradient>
      <radialGradient :id="`${uid}-rim`" cx=".34" cy=".26" r=".8">
        <stop stop-color="#F4F7F7" />
        <stop offset=".42" stop-color="#B8C6CC" />
        <stop offset=".77" stop-color="#657984" />
        <stop offset="1" stop-color="#344852" />
      </radialGradient>
      <radialGradient :id="`${uid}-recess`" cx=".56" cy=".62" r=".7">
        <stop stop-color="#586C76" />
        <stop offset=".7" stop-color="#253A46" />
        <stop offset="1" stop-color="#132631" />
      </radialGradient>
      <linearGradient :id="`${uid}-pipe`" x1="0" y1="0" x2="0" y2="1">
        <stop stop-color="#71848D" />
        <stop offset=".24" stop-color="#DFE7EA" />
        <stop offset=".46" stop-color="#98AAB3" />
        <stop offset=".8" stop-color="#536A77" />
        <stop offset="1" stop-color="#324B59" />
      </linearGradient>
      <filter :id="`${uid}-shadow`" x="-30%" y="-25%" width="170%" height="165%">
        <feDropShadow dx="1.4" dy="3" stdDeviation="2.2" flood-color="#142F3D" flood-opacity=".23" />
      </filter>
      <g :id="`${uid}-bolt`">
        <path d="M-2.8-1.6 0-3.2 2.8-1.6V1.6L0 3.2-2.8 1.6Z" :fill="paint('face')" stroke="#657983" stroke-width=".65" />
        <path d="M-1.4-.8 1.4.8" stroke="#677984" stroke-width=".85" stroke-linecap="round" />
      </g>
    </defs>

    <ellipse cx="65" cy="112" rx="43" ry="5" fill="#254657" opacity=".085" />
    <g :filter="paint('shadow')" stroke-linejoin="round" stroke-linecap="round">
      <!-- A sectional liner reveals the piston crown, rings and connecting rod. -->
      <g v-if="kind === 'cylinder'">
        <path d="M32 22 43 15H85L96 22V84L85 92H43L32 84Z" :fill="paint('steel')" stroke="#60737D" stroke-width="1.2" />
        <path d="M43 27H85V88H43Z" :fill="paint('recess')" />
        <path d="M33 25H43V82L37 86H33Z" :fill="paint('round')" />
        <path d="M85 25H95V82L89 86H85Z" :fill="paint('round')" />
        <path d="M42 27V86M86 27V86" stroke="#EEF3F4" stroke-opacity=".65" stroke-width="1.5" />
        <path d="M57 61H71V98L76 105 72 114H56L52 105 57 98Z" :fill="paint('round')" stroke="#4C626E" />
        <circle cx="64" cy="105" r="5.3" :fill="paint('recess')" stroke="#D0DADE" stroke-width="2" />
        <path d="M46 42Q64 35 82 42V67Q64 74 46 67Z" :fill="paint('round')" stroke="#637983" />
        <ellipse cx="64" cy="42" rx="18" ry="5" :fill="paint('face')" stroke="#657D88" />
        <path d="M46 47Q64 53 82 47M46 52Q64 58 82 52M46 57Q64 63 82 57" stroke="#293E49" stroke-width="2.5" />
        <path d="M47 46Q64 52 81 46M47 51Q64 57 81 51" stroke="#C7A66D" stroke-width="1.4" />
        <path d="M26 22H102V31H26Z" :fill="paint('pipe')" stroke="#6C808B" />
        <path d="M27 22H101" stroke="#EDF2F4" stroke-width="1.4" />
        <use :href="fragment('bolt')" x="34" y="26" />
        <use :href="fragment('bolt')" x="94" y="26" />
        <path d="M29 74H40M29 78H40M88 74H99M88 78H99" stroke="#AAB9BF" stroke-width="2" />
        <path d="M57 16V11H71V16" :fill="paint('dark')" stroke="#50656F" />
      </g>

      <!-- Pressure rail, supports and individual outlet connections. -->
      <g v-else-if="kind === 'fuel'">
        <path d="M29 81 24 103H41L45 81M82 81 87 103H104L98 81" :fill="paint('dark')" stroke="#435C69" />
        <path d="M20 57Q20 49 29 49H101Q110 49 110 57V78Q110 86 101 86H29Q20 86 20 78Z" :fill="paint('pipe')" stroke="#526C79" />
        <ellipse cx="22" cy="67.5" rx="8" ry="18.5" :fill="paint('rim')" stroke="#677E88" />
        <ellipse cx="22" cy="67.5" rx="4" ry="10.5" :fill="paint('recess')" stroke="#C8D2D6" />
        <path d="M30 51H100" stroke="#F3F7F7" stroke-width="1.5" opacity=".8" />
        <path d="M37 48V33Q37 25 46 25H50M65 48V27Q65 19 75 19H80M92 48V35Q92 27 102 27H108" stroke="#715335" stroke-width="9" />
        <path d="M36 48V33Q36 24 46 24H50M64 48V27Q64 18 75 18H80M91 48V35Q91 26 102 26H108" stroke="#C4A06B" stroke-width="6.5" />
        <path d="M34 44H42V54H34ZM61 44H69V54H61ZM88 44H96V54H88Z" :fill="paint('round')" stroke="#647B87" />
        <path d="M49 19H56V30H49ZM79 13H86V24H79ZM107 21H114V32H107Z" :fill="paint('round')" stroke="#647B87" />
        <path d="M46 60V77M76 60V77M103 57V78" stroke="#435D6B" stroke-opacity=".45" />
        <use :href="fragment('bolt')" x="33" y="99" />
        <use :href="fragment('bolt')" x="95" y="99" />
        <rect x="51" y="63" width="25" height="10" rx="1.5" fill="#324B59" stroke="#91A4AE" />
        <path d="M55 67H72M55 70H66" stroke="#BED1D9" stroke-width="1.2" />
      </g>

      <g v-else-if="kind === 'servo'">
        <path d="M23 64 34 55H91L103 64V105H23Z" :fill="paint('dark')" stroke="#4E6673" />
        <path d="M23 64H91V105H23Z" :fill="paint('steel')" />
        <path d="M91 64 103 56V98L91 105Z" :fill="paint('dark')" />
        <rect x="28" y="21" width="29" height="44" rx="13" :fill="paint('round')" stroke="#627987" />
        <ellipse cx="42.5" cy="23" rx="12.5" ry="5" :fill="paint('face')" />
        <path d="M29 47H56M29 52H56" stroke="#5B727F" stroke-width="2" />
        <rect x="32" y="59" width="21" height="8" rx="1" :fill="paint('pipe')" />
        <rect x="67" y="31" width="16" height="32" rx="3" :fill="paint('round')" stroke="#4A6471" />
        <path d="M64 31H86V40H64Z" :fill="paint('dark')" stroke="#4A6471" />
        <path d="M76 25V15H99V66M76 15H90" stroke="#86623C" stroke-width="6" />
        <path d="M75 25V14H98V65" stroke="#D1B07B" stroke-width="3" />
        <circle cx="56" cy="83" r="13" :fill="paint('rim')" stroke="#647D89" />
        <circle cx="56" cy="83" r="9" fill="#E8EEEE" stroke="#4D6776" />
        <path d="M50 81 51 77M55 76V74M60 77 62 75M63 81H65" stroke="#74878F" />
        <path d="M56 83 61 77" stroke="#B17D45" stroke-width="1.8" />
        <circle cx="56" cy="83" r="1.8" fill="#415E6B" />
        <use :href="fragment('bolt')" x="30" y="72" />
        <use :href="fragment('bolt')" x="83" y="72" />
        <use :href="fragment('bolt')" x="30" y="98" />
        <use :href="fragment('bolt')" x="83" y="98" />
      </g>

      <g v-else-if="kind === 'scavenge'">
        <path d="M80 41V19H111V37H98V61Z" :fill="paint('round')" stroke="#59727F" />
        <path d="M76 17H115V25H76Z" :fill="paint('pipe')" stroke="#647C88" />
        <path d="M41 93 35 108H57L62 98M80 93 86 108H108L99 88" :fill="paint('dark')" stroke="#486370" />
        <path d="M91 43C75 25 46 25 31 43 14 63 21 90 43 99 63 108 89 100 100 82 111 65 108 48 99 35L83 40Z" :fill="paint('steel')" stroke="#607B88" stroke-width="1.3" />
        <path d="M94 46C76 30 47 31 33 49" stroke="#EEF3F4" stroke-width="2" opacity=".85" />
        <circle cx="61" cy="67" r="29" :fill="paint('rim')" stroke="#6F8793" stroke-width="1.5" />
        <circle cx="61" cy="67" r="23" :fill="paint('recess')" stroke="#C0CFD6" stroke-width="1.2" />
        <g v-for="turn in 8" :key="turn" :transform="`rotate(${turn * 45} 61 67)`">
          <path d="M61 64Q74 49 80 57L77 67Q69 60 61 70Z" :fill="paint('steel')" stroke="#97A9B3" stroke-width=".6" />
        </g>
        <circle cx="61" cy="67" r="8" :fill="paint('copper')" stroke="#D2B784" />
        <circle cx="61" cy="67" r="3" :fill="paint('face')" />
        <use :href="fragment('bolt')" x="34" y="46" />
        <use :href="fragment('bolt')" x="88" y="48" />
        <use :href="fragment('bolt')" x="83" y="91" />
        <use :href="fragment('bolt')" x="37" y="89" />
      </g>

      <g v-else-if="kind === 'cooling'">
        <path d="M30 83 26 105H43L46 83M82 83 86 105H104L98 83" :fill="paint('dark')" stroke="#506A77" />
        <path d="M31 39H96Q108 39 111 63V74Q108 93 96 93H31Z" :fill="paint('pipe')" stroke="#536D7A" />
        <path d="M34 43H98M34 46H98" stroke="#F1F5F5" stroke-opacity=".6" />
        <path d="M40 41H89V91H40Z" :fill="paint('dark')" />
        <path v-for="rib in 8" :key="rib" :d="`M${40 + rib * 6} 42V90`" stroke="#B5C4CB" stroke-width="2.8" />
        <path v-for="rib in 8" :key="`shadow-${rib}`" :d="`M${42 + rib * 6} 43V89`" stroke="#516B79" stroke-width="1" />
        <ellipse cx="29" cy="66" rx="13" ry="27" :fill="paint('rim')" stroke="#6B828D" />
        <ellipse cx="28" cy="66" rx="7.5" ry="18" :fill="paint('face')" stroke="#879DA8" />
        <path d="M50 40V24H66M88 91V108H70" stroke="#7E6039" stroke-width="10" />
        <path d="M49 39V23H65M87 91V107H70" stroke="#C3A371" stroke-width="6.5" />
        <path d="M61 18H69V29H61ZM65 102H73V113H65Z" :fill="paint('round')" stroke="#627C89" />
        <use :href="fragment('bolt')" x="28" y="45" />
        <use :href="fragment('bolt')" x="28" y="87" />
        <use :href="fragment('bolt')" x="19" y="66" />
        <use :href="fragment('bolt')" x="37" y="66" />
        <use :href="fragment('bolt')" x="34" y="101" />
        <use :href="fragment('bolt')" x="96" y="101" />
      </g>

      <g v-else-if="kind === 'lubrication'">
        <path d="M75 37H107V88H75Z" :fill="paint('round')" stroke="#4C6978" />
        <path d="M82 43V82M88 42V83M94 42V83M100 43V82" stroke="#687F8D" stroke-width="2.5" />
        <path d="M106 42H114V83H106Z" :fill="paint('dark')" stroke="#5A7481" />
        <path d="M34 91 28 107H47L53 96M93 88 98 107H114L108 89" :fill="paint('dark')" stroke="#4D6977" />
        <path d="M33 40V22H56V42M28 78H12V57H32" :fill="paint('copper')" stroke="#98774B" />
        <path d="M29 18H60V27H29ZM9 53H18V82H9Z" :fill="paint('steel')" stroke="#617C8A" />
        <path d="M33 40Q56 27 79 44L90 64 78 89Q56 104 33 90L23 65Z" :fill="paint('steel')" stroke="#5B7582" />
        <circle cx="56" cy="66" r="24" :fill="paint('rim')" stroke="#C1CED4" />
        <circle cx="56" cy="66" r="17" :fill="paint('recess')" stroke="#68828F" />
        <g v-for="tooth in 8" :key="tooth" :transform="`rotate(${tooth * 45} 56 66)`">
          <path d="M52 49H60L61 56H51Z" :fill="paint('copper')" />
        </g>
        <circle cx="56" cy="66" r="12" :fill="paint('copper')" stroke="#D9BC89" />
        <circle cx="56" cy="66" r="6" :fill="paint('round')" stroke="#725A3A" />
        <use :href="fragment('bolt')" x="36" y="47" />
        <use :href="fragment('bolt')" x="76" y="47" />
        <use :href="fragment('bolt')" x="36" y="86" />
        <use :href="fragment('bolt')" x="76" y="86" />
      </g>

      <g v-else-if="kind === 'control-air'">
        <path d="M14 70H114V89H14Z" :fill="paint('copper')" stroke="#8C6D44" />
        <path d="M14 71H114" stroke="#F0D9AC" stroke-width="1.6" />
        <path d="M11 66H22V93H11ZM106 66H117V93H106Z" :fill="paint('round')" stroke="#5B7583" />
        <path d="M45 61 49 42H77L82 61V93H45Z" :fill="paint('round')" stroke="#607A87" />
        <path d="M39 59H88V67H39Z" :fill="paint('pipe')" stroke="#526F7D" />
        <rect x="51" y="26" width="24" height="16" rx="3" :fill="paint('dark')" stroke="#2C4654" />
        <path d="M55 29V38M60 29V38M65 29V38M70 29V38" stroke="#8D9FA9" stroke-width="1.3" />
        <path d="M58 20H68V27H58Z" :fill="paint('round')" />
        <path d="M51 94H76L72 108H55Z" :fill="paint('copper')" stroke="#8C6D44" />
        <path d="M63 54 83 42" stroke="#AF8D57" stroke-width="6" />
        <circle cx="91" cy="36" r="20" :fill="paint('rim')" stroke="#4F6977" />
        <circle cx="91" cy="36" r="15.8" fill="#EDF0EB" stroke="#BBC7CC" />
        <path d="M80 37H83M83 28 85 30M91 24V27M99 28 97 30M102 37H99" stroke="#667D87" stroke-width="1.3" />
        <path d="M91 36 98 29" stroke="#B27F43" stroke-width="2" />
        <circle cx="91" cy="36" r="2.2" fill="#385663" />
        <path d="M86 43H96" stroke="#A9B7BB" stroke-width="1.4" />
        <use :href="fragment('bolt')" x="45" y="63" />
        <use :href="fragment('bolt')" x="82" y="63" />
      </g>

      <g v-else-if="kind === 'exhaust'">
        <path d="M32 75V101M65 75V101M97 75V101" stroke="#344A55" stroke-width="18" />
        <path d="M30 75V101M63 75V101M95 75V101" stroke="#81959E" stroke-width="12" />
        <path d="M19 96H43V106H19ZM52 96H76V106H52ZM84 96H108V106H84Z" :fill="paint('pipe')" stroke="#59727E" />
        <path d="M19 48H95Q112 48 112 65V77H20Z" :fill="paint('pipe')" stroke="#577480" />
        <path d="M28 49V30H48V49M65 48V25H85V49" :fill="paint('round')" stroke="#5A7380" />
        <path d="M23 25H53V35H23ZM60 20H90V30H60Z" :fill="paint('pipe')" stroke="#546D7A" />
        <ellipse cx="18" cy="63" rx="8" ry="20" :fill="paint('rim')" stroke="#5C7480" />
        <ellipse cx="17" cy="63" rx="4.5" ry="13" :fill="paint('recess')" stroke="#BDCBD1" />
        <path d="M29 53H94Q105 53 107 63" stroke="#EFF4F4" stroke-width="1.5" opacity=".8" />
        <path d="M49 53V74M81 53V74" stroke="#455F6D" stroke-width="2" />
        <path d="M46 53V74M78 53V74" stroke="#CDDADE" stroke-width="1" opacity=".7" />
        <use :href="fragment('bolt')" x="28" y="30" />
        <use :href="fragment('bolt')" x="48" y="30" />
        <use :href="fragment('bolt')" x="65" y="25" />
        <use :href="fragment('bolt')" x="85" y="25" />
        <use :href="fragment('bolt')" x="24" y="101" />
        <use :href="fragment('bolt')" x="71" y="101" />
        <use :href="fragment('bolt')" x="103" y="101" />
      </g>

      <g v-else-if="kind === 'icu'">
        <path d="M28 52 43 41H103V95L88 106H28Z" :fill="paint('steel')" stroke="#5B7380" />
        <path d="M88 52 103 41V95L88 106Z" :fill="paint('dark')" />
        <path d="M28 52H88V106H28Z" :fill="paint('face')" stroke="#768D99" />
        <path d="M31 54H85" stroke="#FAFCFC" stroke-width="1.4" />
        <path d="M37 27H53V51H37ZM66 25H82V51H66Z" :fill="paint('round')" stroke="#526F7C" />
        <rect x="33" y="18" width="24" height="20" rx="3" :fill="paint('dark')" stroke="#344D5B" />
        <rect x="62" y="16" width="24" height="20" rx="3" :fill="paint('dark')" stroke="#344D5B" />
        <path d="M38 21H52M67 19H81" stroke="#B9C7CE" stroke-width="1.2" />
        <path d="M41 18V12H50V18M70 16V10H79V16" :fill="paint('round')" stroke="#5D7784" />
        <circle cx="47" cy="72" r="10" :fill="paint('copper')" stroke="#9A7848" />
        <circle cx="47" cy="72" r="5.5" :fill="paint('recess')" />
        <circle cx="71" cy="72" r="10" :fill="paint('rim')" stroke="#76909E" />
        <circle cx="71" cy="72" r="5.5" :fill="paint('recess')" />
        <rect x="42" y="88" width="33" height="9" rx="1" fill="#496572" />
        <path d="M47 92H69" stroke="#D7E1E5" stroke-width="1.2" />
        <path d="M98 62H112V78H98" :fill="paint('copper')" stroke="#8C6E46" />
        <path d="M108 58H116V82H108Z" :fill="paint('round')" stroke="#5B7683" />
        <use :href="fragment('bolt')" x="35" y="59" />
        <use :href="fragment('bolt')" x="81" y="59" />
        <use :href="fragment('bolt')" x="35" y="99" />
        <use :href="fragment('bolt')" x="81" y="99" />
      </g>

      <g v-else-if="kind === 'vcu'">
        <path d="M57 71H71V101H57Z" :fill="paint('round')" stroke="#667F8C" />
        <path d="M42 103 57 96H71L86 103V109H42Z" :fill="paint('steel')" stroke="#617A87" />
        <ellipse cx="64" cy="108" rx="22" ry="5" :fill="paint('rim')" />
        <path d="M38 26H90V73Q64 86 38 73Z" :fill="paint('round')" stroke="#627C89" />
        <ellipse cx="64" cy="26" rx="26" ry="8" :fill="paint('face')" stroke="#7F96A1" />
        <path d="M32 26H96V35H32Z" :fill="paint('pipe')" stroke="#647F8C" />
        <path d="M32 66H96V75H32Z" :fill="paint('pipe')" stroke="#647F8C" />
        <path d="M39 36V65M89 36V65" stroke="#394F5C" stroke-width="3.5" />
        <path d="M38 36V65M88 36V65" stroke="#E4EBEE" stroke-width="1.3" />
        <path d="M90 46H108V24H100" stroke="#8E6E45" stroke-width="7" />
        <path d="M90 45H107V23H100" stroke="#D7BB86" stroke-width="4" />
        <path d="M52 11H76V24H52Z" :fill="paint('dark')" stroke="#42616F" />
        <path d="M55 13H73" stroke="#A7BCC5" />
        <path d="M29 43H39V57H29Z" :fill="paint('copper')" stroke="#9C7B49" />
        <use :href="fragment('bolt')" x="38" y="30" />
        <use :href="fragment('bolt')" x="89" y="30" />
        <use :href="fragment('bolt')" x="38" y="71" />
        <use :href="fragment('bolt')" x="89" y="71" />
      </g>

      <g v-else>
        <rect x="30" y="31" width="68" height="68" rx="12" :fill="paint('steel')" stroke="#607A87" />
        <circle cx="64" cy="65" r="22" :fill="paint('rim')" stroke="#DBE4E8" />
        <circle cx="64" cy="65" r="12" :fill="paint('recess')" />
        <use :href="fragment('bolt')" x="39" y="40" />
        <use :href="fragment('bolt')" x="89" y="40" />
        <use :href="fragment('bolt')" x="39" y="90" />
        <use :href="fragment('bolt')" x="89" y="90" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.engine-part-icon {
  display: inline-block;
  flex: 0 0 auto;
  vertical-align: middle;
  overflow: visible;
}
</style>
