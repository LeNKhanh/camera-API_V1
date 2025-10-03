--
-- PostgreSQL database dump
--

\restrict NeKVtTRLgLp3QtIQnMkJ56U6WS6CEpQSUvIvDN2IieaRH1oPJASa5MagdsTg0mR

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

-- Started on 2025-10-01 11:18:05

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 16551)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 4988 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 219 (class 1259 OID 16487)
-- Name: cameras; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cameras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    ip_address character varying(100) NOT NULL,
    rtsp_url character varying(255),
    rtsp_port integer DEFAULT 554 NOT NULL,
    onvif_url character varying(255),
    username character varying(100),
    password character varying(100),
    codec character varying(20) DEFAULT 'H.264'::character varying NOT NULL,
    resolution character varying(20) DEFAULT '1080p'::character varying NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sdk_port integer DEFAULT 37777,
    vendor character varying(50) DEFAULT 'dahua'::character varying NOT NULL,
    channel integer DEFAULT 1 NOT NULL
);


ALTER TABLE public.cameras OWNER TO postgres;

--
-- TOC entry 222 (class 1259 OID 16532)
-- Name: events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    camera_id uuid,
    type character varying(50) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    ack boolean DEFAULT false NOT NULL
);


ALTER TABLE public.events OWNER TO postgres;

--
-- TOC entry 224 (class 1259 OID 16578)
-- Name: migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.migrations OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16577)
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.migrations_id_seq OWNER TO postgres;

--
-- TOC entry 4989 (class 0 OID 0)
-- Dependencies: 223
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- TOC entry 225 (class 1259 OID 16589)
-- Name: ptz_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ptz_logs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    action character varying(40) NOT NULL,
    speed integer DEFAULT 1 NOT NULL,
    vector_pan integer DEFAULT 0 NOT NULL,
    vector_tilt integer DEFAULT 0 NOT NULL,
    vector_zoom integer DEFAULT 0 NOT NULL,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    "ILoginID" character varying(64) NOT NULL,
    "nChannelID" integer DEFAULT 1 NOT NULL,
    command_code integer DEFAULT 0 NOT NULL,
    param1 integer,
    param2 integer,
    param3 integer
);


ALTER TABLE public.ptz_logs OWNER TO postgres;

--
-- TOC entry 220 (class 1259 OID 16503)
-- Name: recordings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recordings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    camera_id uuid,
    storage_path character varying(255) NOT NULL,
    duration_sec integer NOT NULL,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    error_message character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    strategy character varying(20) DEFAULT 'RTSP'::character varying NOT NULL
);


ALTER TABLE public.recordings OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16519)
-- Name: snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    camera_id uuid,
    storage_path character varying(255) NOT NULL,
    captured_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.snapshots OWNER TO postgres;

--
-- TOC entry 218 (class 1259 OID 16477)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    username character varying(50) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    refresh_token_hash character varying(255),
    refresh_token_exp timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 4800 (class 2604 OID 16581)
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- TOC entry 4976 (class 0 OID 16487)
-- Dependencies: 219
-- Data for Name: cameras; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cameras (id, name, ip_address, rtsp_url, rtsp_port, onvif_url, username, password, codec, resolution, enabled, created_at, updated_at, sdk_port, vendor, channel) FROM stdin;
bb8541af-9d5f-4f08-8a07-c20a358a2475	Demo Fake	192.168.1.50	\N	554	\N	\N	\N	H.264	1080p	t	2025-09-29 10:18:43.387226+07	2025-09-29 10:18:43.387226+07	\N	dahua	1
eb1501b3-9b2a-4768-92e7-152d17733747	channel1	192.168.1.10	\N	554	\N	user	pass	H.264	1080p	t	2025-09-25 15:59:15.766053+07	2025-09-25 15:59:15.766053+07	\N	dahua	1
6b6dd4e4-b3a9-4fce-ae61-4c288c73856b	channel 2	192.168.1.10	rtsp://admin:Abc12345@192.168.1.10:554/cam/realmonitor?channel=2&subtype=0	554	\N	admin	Abc12345	H.264	1080p	t	2025-09-30 10:33:34.833158+07	2025-09-30 10:33:34.833158+07	37777	dahua	2
f2625f65-f2de-4603-a92d-ec86539d0a04	NVR Test CH1	192.168.1.60	rtsp://admin:Abc12345@192.168.1.60:554/cam/realmonitor?channel=1&subtype=0	554	\N	admin	Abc12345	H.264	1080p	t	2025-10-01 09:08:55.979925+07	2025-10-01 09:08:55.979925+07	37777	dahua	1
db0f1f51-4153-4348-ada4-c64843cac142	NVR Test CH2	192.168.1.60	rtsp://admin:Abc12345@192.168.1.60:554/cam/realmonitor?channel=2&subtype=0	554	\N	admin	Abc12345	H.264	1080p	t	2025-10-01 09:08:55.987401+07	2025-10-01 09:08:55.987401+07	37777	dahua	2
9191910f-7757-4fbc-983b-c9ddcb994598	NVR Test CH3	192.168.1.60	rtsp://admin:Abc12345@192.168.1.60:554/cam/realmonitor?channel=3&subtype=0	554	\N	admin	Abc12345	H.264	1080p	t	2025-10-01 09:08:55.989332+07	2025-10-01 09:08:55.989332+07	37777	dahua	3
827ca00b-143e-407d-984b-6f7b9c1087df	Kho chứa 1	192.168.1.30	rtsp://admin:Abc12345@192.168.1.30:554/cam/realmonitor?channel=1&subtype=0	554	\N	admin	Abc12345	H.264	1080p	t	2025-10-01 08:41:07.345734+07	2025-10-01 09:20:11.31091+07	37777	dahua	1
\.


--
-- TOC entry 4979 (class 0 OID 16532)
-- Dependencies: 222
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.events (id, camera_id, type, description, created_at, ack) FROM stdin;
2354af94-2dbd-4684-ae71-832b5e772b56	eb1501b3-9b2a-4768-92e7-152d17733747	ALERT	Nhiệt độ vượt ngưỡng 55°C	2025-09-29 15:56:28.777487+07	f
\.


--
-- TOC entry 4981 (class 0 OID 16578)
-- Dependencies: 224
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.migrations (id, "timestamp", name) FROM stdin;
1	1758794190088	AutoMigration1758794190088
2	1758799000000	AddRefreshColumnsAndPtzlogs1758799000000
3	1758800000000	DahuaOnly1758800000000
4	1759201702915	AutoMigration1759201702915
5	1759300000000	AddCameraChannel1759300000000
6	1759301000000	AlterPtzLogsLoginIdChannel1759301000000
7	1759400000000	AddPtzCommandCode1759400000000
8	1759291221846	AutoMigration1759291221846
9	1759401000000	AddPtzParams1759401000000
\.


--
-- TOC entry 4982 (class 0 OID 16589)
-- Dependencies: 225
-- Data for Name: ptz_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ptz_logs (id, action, speed, vector_pan, vector_tilt, vector_zoom, duration_ms, created_at, "ILoginID", "nChannelID", command_code, param1, param2, param3) FROM stdin;
2c683fe1-9dbc-4be4-969f-d355493088a8	PAN_RIGHT	2	2	0	0	1500	2025-10-01 10:26:11.552444+07	9191910f-7757-4fbc-983b-c9ddcb994598	3	0	\N	\N	\N
8199174d-da6c-4186-88e3-08a6094901af	PAN_RIGHT	5	5	0	0	1500	2025-10-01 10:29:32.956422+07	9191910f-7757-4fbc-983b-c9ddcb994598	3	0	\N	\N	\N
04a5d9c0-04c2-46fb-93c2-de9a72a81488	PAN_LEFT	5	-5	0	0	1500	2025-10-01 10:37:03.218338+07	9191910f-7757-4fbc-983b-c9ddcb994598	3	3	\N	\N	\N
ca0c51da-9ab1-454e-b6bd-0b79f08f117d	PAN_RIGHT	5	5	0	0	1500	2025-10-01 10:37:50.172081+07	9191910f-7757-4fbc-983b-c9ddcb994598	3	4	\N	\N	\N
2631c500-4e04-40c2-85ba-dcf6c7f0403c	PAN_LEFT	10	-10	0	0	1500	2025-10-01 10:38:22.478014+07	9191910f-7757-4fbc-983b-c9ddcb994598	3	3	\N	\N	\N
c3bffa16-1218-4dc5-8b98-9b187f0b370d	PAN_LEFT	10	-10	0	0	1500	2025-10-01 11:01:49.963937+07	9191910f-7757-4fbc-983b-c9ddcb994598	3	3	\N	8	\N
81e5f3c5-889b-4874-aebb-98d465bdbc69	PAN_LEFT	10	-10	0	0	\N	2025-09-29 15:14:28.018676+07	eb1501b3-9b2a-4768-92e7-152d17733747	1	0	\N	\N	\N
a95d5f49-834d-4fad-8e20-4d1f15121d65	PAN_LEFT	10	-10	0	0	\N	2025-09-29 15:14:40.623225+07	eb1501b3-9b2a-4768-92e7-152d17733747	1	0	\N	\N	\N
2543da1f-5ae8-4454-979a-ff8fa6982d19	PAN_LEFT	10	-10	0	0	\N	2025-09-29 15:14:41.217631+07	eb1501b3-9b2a-4768-92e7-152d17733747	1	0	\N	\N	\N
a6c39692-d86a-4638-b7f1-09e7c1080456	PAN_LEFT	10	-10	0	0	\N	2025-09-29 15:14:41.715382+07	eb1501b3-9b2a-4768-92e7-152d17733747	1	0	\N	\N	\N
3aa1a69f-87d8-4ede-93e8-8d6dc65bccde	PAN_LEFT	10	-10	0	0	\N	2025-09-29 15:14:42.253274+07	eb1501b3-9b2a-4768-92e7-152d17733747	1	0	\N	\N	\N
801daf4d-80f9-4d04-8a0a-f26bd2287eb8	PAN_RIGHT	3	3	0	0	\N	2025-09-29 15:15:16.367054+07	bb8541af-9d5f-4f08-8a07-c20a358a2475	1	0	\N	\N	\N
892266fe-7710-4023-9ecb-fe4943be5d13	PAN_RIGHT	3	3	0	0	\N	2025-09-29 15:15:16.959919+07	bb8541af-9d5f-4f08-8a07-c20a358a2475	1	0	\N	\N	\N
1b19030b-35ce-4dbe-a343-7f44ca657cf9	PAN_RIGHT	3	3	0	0	\N	2025-09-29 15:15:17.427339+07	bb8541af-9d5f-4f08-8a07-c20a358a2475	1	0	\N	\N	\N
4f16a880-d42a-4e29-abcf-a910d1781375	PAN_RIGHT	3	3	0	0	\N	2025-09-29 15:15:17.881101+07	bb8541af-9d5f-4f08-8a07-c20a358a2475	1	0	\N	\N	\N
521b1f5b-c6a6-4263-98be-8e3ca1a4fe12	PAN_RIGHT	4	4	0	0	\N	2025-09-29 15:16:50.35168+07	bb8541af-9d5f-4f08-8a07-c20a358a2475	1	0	\N	\N	\N
119fa282-dceb-4d51-8438-81cd5734fc32	PAN_RIGHT	4	4	0	0	\N	2025-09-29 15:16:50.908662+07	bb8541af-9d5f-4f08-8a07-c20a358a2475	1	0	\N	\N	\N
17077b05-3314-4130-9b55-ab66de27ef47	PAN_RIGHT	4	4	0	0	\N	2025-09-29 15:16:51.519911+07	bb8541af-9d5f-4f08-8a07-c20a358a2475	1	0	\N	\N	\N
dbfc88b0-9ebc-495d-b268-3b119aeda7fb	PAN_RIGHT	4	4	0	0	\N	2025-09-29 15:16:52.050179+07	bb8541af-9d5f-4f08-8a07-c20a358a2475	1	0	\N	\N	\N
b054a5c0-84a3-4d6a-a327-aa075d0e4e93	PAN_RIGHT	4	4	0	0	\N	2025-09-29 15:16:52.66718+07	bb8541af-9d5f-4f08-8a07-c20a358a2475	1	0	\N	\N	\N
bea021e7-88f3-4261-a633-8a7d49bc453d	PAN_RIGHT	4	4	0	0	\N	2025-09-29 15:16:53.305851+07	bb8541af-9d5f-4f08-8a07-c20a358a2475	1	0	\N	\N	\N
b9af3d94-b1a4-428f-9bec-ec6cd1ff5773	PAN_LEFT	2	-2	0	0	1500	2025-10-01 09:47:50.419227+07	9191910f-7757-4fbc-983b-c9ddcb994598	3	0	\N	\N	\N
\.


--
-- TOC entry 4977 (class 0 OID 16503)
-- Dependencies: 220
-- Data for Name: recordings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recordings (id, camera_id, storage_path, duration_sec, started_at, ended_at, status, error_message, created_at, strategy) FROM stdin;
b938acaf-b766-4a4a-9ebf-d17d0a56e878	bb8541af-9d5f-4f08-8a07-c20a358a2475	C:\\tmp\\c711202f-eac5-46b8-b6da-f7582e7ddabb.mp4	10	2025-09-29 10:38:33.37+07	2025-09-29 10:38:33.409+07	FAILED	ffmpeg exit code 1	2025-09-29 10:38:33.37063+07	RTSP
6459d087-d887-41f9-8692-37469ed5abc2	bb8541af-9d5f-4f08-8a07-c20a358a2475	C:\\tmp\\3165086f-62ff-42ca-aab7-3539b282c2e9.mp4	10	2025-09-29 10:59:20.741+07	2025-09-29 10:59:20.778+07	FAILED	FFMPEG_TIMEOUT_code=1 Unrecognized option 'stimeout'. Error splitting the argument list: Option not found 	2025-09-29 10:59:20.7464+07	RTSP
98a08ae9-4d14-4271-87f9-a7844e400b4d	eb1501b3-9b2a-4768-92e7-152d17733747	C:\\tmp\\demo_8.mp4	60	2025-09-29 13:43:24.125+07	2025-09-29 13:44:51.874+07	COMPLETED	STOPPED_BY_USER	2025-09-29 13:43:24.130555+07	FAKE
555bd41f-751c-4c4e-964b-4f7d0711dcc0	eb1501b3-9b2a-4768-92e7-152d17733747	C:\\tmp\\3926790b-7d23-4f87-b0fb-14b9332d815b.mp4	10	2025-09-29 11:01:15.47+07	2025-09-29 11:01:15.536+07	FAILED	FFMPEG_TIMEOUT_code=1 Unrecognized option 'stimeout'. Error splitting the argument list: Option not found 	2025-09-29 11:01:15.472054+07	RTSP
e5fb7ada-df14-4fdd-b003-5b056fe7e574	eb1501b3-9b2a-4768-92e7-152d17733747	C:\\tmp\\demo_fake.mp4	5	2025-09-29 11:07:12.564+07	2025-09-29 11:07:12.658+07	FAILED	FAKE_FILTER_FAILED	2025-09-29 11:07:12.566335+07	RTSP
eb911569-cd30-433e-9915-6a810ca72e7c	eb1501b3-9b2a-4768-92e7-152d17733747	C:\\tmp\\demo_2.mp4	5	2025-09-29 11:16:11.863+07	2025-09-29 11:16:11.986+07	FAILED	FAKE_UNKNOWN [Parsed_color_0 @ 0000014024f74080] Unable to parse option value "undefined" as image size [Parsed_color_0 @ 0000014024f74080] Error setting option s to value undefined. 	2025-09-29 11:16:11.865606+07	FAKE
358eaec2-0804-4690-9ed0-af1b01fd394c	eb1501b3-9b2a-4768-92e7-152d17733747	C:\\tmp\\demo_3.mp4	30	2025-09-29 11:19:49.671+07	2025-09-29 11:19:49.767+07	FAILED	FAKE_UNKNOWN [Parsed_color_0 @ 000001d42f454080] Unable to parse option value "undefined" as image size [Parsed_color_0 @ 000001d42f454080] Error setting option s to value undefined. 	2025-09-29 11:19:49.672299+07	FAKE
f9604005-473e-4954-87b6-edc467794a1e	eb1501b3-9b2a-4768-92e7-152d17733747	C:\\tmp\\demo_9.mp4	60	2025-09-29 13:53:01.556+07	2025-09-29 13:54:01.61+07	COMPLETED	\N	2025-09-29 13:53:01.562673+07	FAKE
c38bb64c-bdd7-4426-9b9d-0c116a801371	eb1501b3-9b2a-4768-92e7-152d17733747	C:\\tmp\\demo_4.mp4	50	2025-09-29 11:26:23.322+07	2025-09-29 11:26:23.464+07	FAILED	FAKE_UNKNOWN [Parsed_color_0 @ 000001f7104b4080] Unable to parse option value "undefined" as image size [Parsed_color_0 @ 000001f7104b4080] Error setting option s to value undefined. 	2025-09-29 11:26:23.32587+07	FAKE
eee2b739-73ae-4c10-8af4-3d477922d12a	eb1501b3-9b2a-4768-92e7-152d17733747	C:\\tmp\\demo_5.mp4	10	2025-09-29 11:27:51.945+07	2025-09-29 11:27:52.088+07	FAILED	FAKE_UNKNOWN [Parsed_color_0 @ 000001eee3044080] Unable to parse option value "undefined" as image size [Parsed_color_0 @ 000001eee3044080] Error setting option s to value undefined. 	2025-09-29 11:27:51.946707+07	FAKE
7368765f-d998-438e-9dd2-02b6fcfb6422	eb1501b3-9b2a-4768-92e7-152d17733747	C:\\tmp\\demo_6.mp4	10	2025-09-29 11:35:16.171+07	2025-09-29 11:35:16.283+07	FAILED	FAKE_UNKNOWN [Parsed_color_0 @ 0000027f65264080] Unable to parse option value "undefined" as image size [Parsed_color_0 @ 0000027f65264080] Error setting option s to value undefined. 	2025-09-29 11:35:16.173098+07	FAKE
5ac09fbb-f1de-415d-951b-1d8717b0e893	eb1501b3-9b2a-4768-92e7-152d17733747	C:\\tmp\\demo_6.mp4	60	2025-09-29 11:37:48.653+07	2025-09-29 11:37:48.75+07	FAILED	FAKE_UNKNOWN [Parsed_color_0 @ 0000020d67064080] Unable to parse option value "undefined" as image size [Parsed_color_0 @ 0000020d67064080] Error setting option s to value undefined. 	2025-09-29 11:37:48.654007+07	FAKE
6da1b434-df63-4b10-8b17-db4405681c30	eb1501b3-9b2a-4768-92e7-152d17733747	C:\\tmp\\demo_10.mp4	60	2025-09-29 13:54:21.516+07	2025-09-29 13:55:56.141+07	COMPLETED	STOPPED_BY_USER	2025-09-29 13:54:21.51722+07	FAKE
36bddf86-958e-4038-860d-c83f28eb784d	eb1501b3-9b2a-4768-92e7-152d17733747	C:\\tmp\\6d99ba90-8926-4efe-b7c5-0d823eb9b12f.mp4	60	2025-09-29 11:50:23.97+07	2025-09-29 11:50:24.098+07	FAILED	FAKE_UNKNOWN [Parsed_color_0 @ 000002d825be4100] Unable to parse option value "undefined" as image size [Parsed_color_0 @ 000002d825be4100] Error setting option s to value undefined. 	2025-09-29 11:50:23.971315+07	FAKE
2af7ee2f-6a85-48bd-874f-c2ad02de1bd5	eb1501b3-9b2a-4768-92e7-152d17733747	C:\\tmp\\demo_fake1.mp4	50	2025-09-29 11:53:14.543+07	2025-09-29 11:53:14.673+07	FAILED	FAKE_UNKNOWN [Parsed_color_0 @ 0000023e79d74080] Unable to parse option value "undefined" as image size [Parsed_color_0 @ 0000023e79d74080] Error setting option s to value undefined. 	2025-09-29 11:53:14.544644+07	FAKE
8fbc1b2e-4b1a-4d3a-aa67-f03a0e8deda5	eb1501b3-9b2a-4768-92e7-152d17733747	C:\\tmp\\demo_fake2.mp4	50	2025-09-29 11:57:22.552+07	2025-09-29 11:57:23.554+07	COMPLETED	\N	2025-09-29 11:57:22.555063+07	FAKE
8d86df1d-7582-40cf-a29c-0298a474f462	eb1501b3-9b2a-4768-92e7-152d17733747	C:\\tmp\\demo_fake3.mp4	60	2025-09-29 11:57:57.405+07	2025-09-29 11:57:58.6+07	COMPLETED	\N	2025-09-29 11:57:57.406288+07	FAKE
\.


--
-- TOC entry 4978 (class 0 OID 16519)
-- Dependencies: 221
-- Data for Name: snapshots; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.snapshots (id, camera_id, storage_path, captured_at, created_at) FROM stdin;
8b363f55-6dfa-42cf-be66-9c4021620335	6b6dd4e4-b3a9-4fce-ae61-4c288c73856b	C:\\tmp\\a100.jpg	2025-10-01 09:28:08.613496+07	2025-10-01 09:28:08.613496+07
\.


--
-- TOC entry 4975 (class 0 OID 16477)
-- Dependencies: 218
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password_hash, role, created_at, refresh_token_hash, refresh_token_exp, updated_at) FROM stdin;
80bf16b3-bc74-4526-a970-d6b8297e2be2	operator1	$2b$10$6tQDhNI6OHWNKLzfbEfa0e5LM3GBgbD2.aTlTn0ZF/z3dTC6EDkka	OPERATOR	2025-09-25 15:57:25.304835+07	\N	\N	2025-09-30 10:08:28.995665+07
c55ddf04-c164-4276-a2bf-a26049f4bd23	viewer2	$2b$10$CSrgr2neXbRZsRYNw0.xmOKRqDrs5Zqx5qp.9wDhv/vizxWYw4C1e	VIEWER	2025-09-30 13:05:22.970238+07	\N	\N	2025-09-30 13:05:22.970238+07
58194a15-e832-4d2d-987c-9477a090a21d	admin	$2b$10$NiSC4xYCz9qq87tmdl/62efHPG4YSGHCittXth5O1uS4HJp.tpkDO	ADMIN	2025-09-25 15:29:40.475527+07	$2b$10$qaxiWyMU/2CkVtBhPN4ib.kF3jw0Vo9Fzj6zI42CVmG9vpw8kq0Em	2025-10-08 11:01:39.529+07	2025-10-01 11:01:39.531625+07
\.


--
-- TOC entry 4990 (class 0 OID 0)
-- Dependencies: 223
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.migrations_id_seq', 9, true);


--
-- TOC entry 4826 (class 2606 OID 16599)
-- Name: ptz_logs PK_377402f9e86ecd24f532c703e78; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ptz_logs
    ADD CONSTRAINT "PK_377402f9e86ecd24f532c703e78" PRIMARY KEY (id);


--
-- TOC entry 4824 (class 2606 OID 16585)
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- TOC entry 4814 (class 2606 OID 16692)
-- Name: cameras UQ_b7348073fead98be9d48a27a1e0; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cameras
    ADD CONSTRAINT "UQ_b7348073fead98be9d48a27a1e0" UNIQUE (ip_address, channel);


--
-- TOC entry 4816 (class 2606 OID 16500)
-- Name: cameras cameras_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cameras
    ADD CONSTRAINT cameras_pkey PRIMARY KEY (id);


--
-- TOC entry 4822 (class 2606 OID 16541)
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- TOC entry 4818 (class 2606 OID 16513)
-- Name: recordings recordings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT recordings_pkey PRIMARY KEY (id);


--
-- TOC entry 4820 (class 2606 OID 16526)
-- Name: snapshots snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.snapshots
    ADD CONSTRAINT snapshots_pkey PRIMARY KEY (id);


--
-- TOC entry 4810 (class 2606 OID 16484)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4812 (class 2606 OID 16486)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 4828 (class 2606 OID 16572)
-- Name: snapshots FK_33fa7db65b336d856ec74ad9cdf; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.snapshots
    ADD CONSTRAINT "FK_33fa7db65b336d856ec74ad9cdf" FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE CASCADE;


--
-- TOC entry 4827 (class 2606 OID 16562)
-- Name: recordings FK_3b3931f8be841c1b73fdc93cb37; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recordings
    ADD CONSTRAINT "FK_3b3931f8be841c1b73fdc93cb37" FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE CASCADE;


--
-- TOC entry 4829 (class 2606 OID 16567)
-- Name: events FK_3c5f10b10544c86d09f778d26b5; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT "FK_3c5f10b10544c86d09f778d26b5" FOREIGN KEY (camera_id) REFERENCES public.cameras(id) ON DELETE CASCADE;


-- Completed on 2025-10-01 11:18:05

--
-- PostgreSQL database dump complete
--

\unrestrict NeKVtTRLgLp3QtIQnMkJ56U6WS6CEpQSUvIvDN2IieaRH1oPJASa5MagdsTg0mR

