
/******************************************************************************
* File: iflytek_EqDrcDrawApi.h
* Author: ZhengZhichao
* Create Date : 2022-12-28
* Update : 2023-2-1
* Version : V1.0
* Description : EQ and DRC APi head file for clients
*
* All rights reserved
******************************************************************************/
#ifndef IFLYTEK_EQ_DRC_DRAW_API
#define IFLYTEK_EQ_DRC_DRAW_API
#pragma once
/*********************** EQ DRAW ***********************/
/******************* EQ Return Code *******************/
#define IFLYTEK_EQ_OK                             (0)
#define IFLYTEK_EQ_ERR                            (-1)
#define IFLYTEK_EQ_PRM_NULL                       (-2)
#define IFLYTEK_EQ_ENABLE_ERR                     (-3)

#define IFLYTEK_EQ_FILTER_ENABLE_ERR			  (-5)
#define IFLYTEK_EQ_FILTER_TYPE_ERR			      (-6)
#define IFLYTEK_EQ_FILTER_SAMPLE_RATE_ERR         (-7)
#define IFLYTEK_EQ_FILTER_Q_ERR					  (-8)
#define IFLYTEK_EQ_FILTER_GAIN_ERR				  (-9)
#define IFLYTEK_EQ_FILTER_FREQ_ERR			      (-10)

#define IFLYTEK_EQ_UI_PRM_NULL                    (-11)
#define IFLYTEK_EQ_UI_PRM_NUM_ERR                 (-12)
#define IFLYTEK_EQ_UI_PRM_FREQ_ERR                (-13)
#define IFLYTEK_EQ_UI_PRM_GAIN_ERR                (-14)

#define IFLYTEK_EQ_OUT_Y_NULL                     (-15)

/************************************************/

#define FILTER_BANK_NUM				  (10)
#define FILTER_PARAMETER_LENGTH       (3)   // Filter Size

/***********参数范围定义*************/ 
//滤波器器类型
#define IFLYTEK_PEQ_LOWPASS_FILTER    (0)
#define IFLYTEK_PEQ_HIGHPASS_FILTER   (1)
#define IFLYTEK_PEQ_PEAK_FILTER       (2)
#define IFLYTEK_PEQ_LOWSHELF_FILTER   (3)
#define IFLYTEK_PEQ_HIGHSHELF_FILTER  (4)
#define IFLYTEK_PEQ_BANDPASS_FILTER   (5)

//采样率
#define IFLYTEK_EQ_SAMPLE_RATE				(48000.0)
#define IFLYTEK_EQ_SAMPLE_RATE_16000        (16000.0)
//品质因子
#define IFLYTEK_EQ_MAX_Q             (10.0)
#define IFLYTEK_EQ_MIN_Q             (0.3)
//增益
#define IFLYTEK_EQ_MAX_GAIN          (30.0)
#define IFLYTEK_EQ_MIN_GAIN          (-30.0)
//中心/截止频率
#define IFLYTEK_EQ_MAX_FREQ          (20000.0)
#define IFLYTEK_EQ_MIN_FREQ          (20.0)
//声道数
#define IFLYTEK_PEQ_PROCESS_CHAN      (2)

//滤波器类型
#define LOWPASS_FILTER                (0)
#define HIGHPASS_FILTER               (1)
#define PEAK_FILTER					  (2)
#define LOWSHELF_FILTER               (3)
#define HIGHSHELF_FILTER              (4)

//支持的采样率
typedef enum {
	PEQ_SAMPLERATE_16000 = 16000,
	PEQ_SAMPLERATE_48000 = 48000
}PEQ_SAMPLERATE_E;

/***********参数结构体定义*************/
typedef struct
{
	double b[FILTER_PARAMETER_LENGTH];
	double a[FILTER_PARAMETER_LENGTH];
}coff;

typedef struct _struFilterPrm
{
	unsigned char FilterEnable;				//使能开关		0或者1
	unsigned char FilterType;				//滤波器类型	LowPass / HighPass / Peak / LowShef / HighShelf
	float  		  fSampleRateHz;    		//采样率		48000
	float         fQ;    					//品质因子		0.3-10.0
	float         fDbGain;    				//增益
	float         fFreqHz;    				//中心频率
}struFilterPrm, *pststruFilterPrm;

typedef struct _struMonoEqPrm
{
	unsigned char  Enable;						//声道EQ使能开关(0:关闭,1:开启)
	struFilterPrm  FilterPrm[FILTER_BANK_NUM];	//声道的滤波器组配置参数
}struMonoEqPrm, *pstMonoEqPrm, struPeqPrm, *pstPeqPrm;

typedef struct
{
	double startFreq;   // 开始频率 e.g 20
	double endFreq;     // 结束频率 e.g 24000
	double startGain;   // 开始增益 e.g -10
	double endGain;     // 结束增益 e.g 15
	int xNum;           // 横坐标像素点数 e.g 1024 --> 0~1023
	int yNum;           // 纵坐标像素点数 e.g 30 --> 0~29
}struUIXYInfo;

/**************** 客户函数定义 ******************/
/**
* 将y坐标点转化为增益
*
* @param y
* @param XYData 绘图参数
* @return fdBGain
*/
double EqCalcYToGain(int y, struUIXYInfo *XYData);

/**
* 将增益转化为y坐标点
*
* @param fdBGain
* @param XYData 绘图参数
* @return y
*/
int EqCalcGainToY(double fdBGain, struUIXYInfo *XYData);

/**
* 将频率转化为x坐标
*
* @param fFreq
* @param XYData 绘图参数
* @return x;
*/
int EqCalcFreqToX(double fFreq, struUIXYInfo *XYData);

/**
* 将x坐标转化为频率
*
* @param x 输入x坐标
* @param XYData 绘图参数
* @return fFreq;
*/
double EqCalcXToFreq(int x, struUIXYInfo *XYData);
/**
* EQ 绘图函数
* @param pstEqPrm 级联滤波器参数 
* @param XYData 绘图参数
* @param Y 返回增益，需要用户提前申请好空间
* @return 返回码，0表示正确，小于0表示报错，具体错误参照返回码
*/
int EqDraw(pstMonoEqPrm pstEqPrm, struUIXYInfo *XYData, double *Y);

/**************************** EQ End *******************************/

/*************************** Drc Header ***************************/
#define IFLYTEK_DRC_OK                                                 (0)
#define IFLYTEK_DRC_ERR                                               (-1)
#define IFLYTEK_DRC_OBJ_NULL                                          (-2)
#define IFLYTEK_DRC_PRM_NULL                                          (-3)
#define IFLYTEK_DRC_INPUT_NULL                                        (-4)
#define IFLYTEK_DRC_OUTPUT_NULL                                       (-5)
#define IFLYTEK_DRC_ENABLE_ERR                                        (-6)
#define IFLYTEK_DRC_SAMPLERATE_ERR                                    (-7)
#define IFLYTEK_DRC_USEPOINTS_ERR                                     (-8)
#define IFLYTEK_DRC_ARRTIME_ERR                                       (-9)
#define IFLYTEK_DRC_RELTIME_ERR                                      (-10)
#define IFLYTEK_DRC_POINT_X_ERR                                      (-11)
#define IFLYTEK_DRC_POINT_Y_ERR                                      (-12)
#define IFLYTEK_DRC_OUTPUTDB_ERR                                     (-13)
#define IFLYTEK_DRC_STEREO_ERR                                       (-14)

#define IFLYTEK_DRC_UI_OK                                            (-15)
#define IFLYTEK_DRC_UI_ERR                                           (-16)
#define IFLYTEK_DRC_UI_NUMBER_ERR                                    (-17)
#define IFLYTEK_DRC_UI_STARTGAIN_X_ERR                               (-18)
#define IFLYTEK_DRC_UI_ENDGAIN_X_ERR                                 (-19)
#define IFLYTEK_DRC_UI_PRM_NULL                                      (-20)
#define IFLYTEK_DRC_UI_STARTGAIN_Y_ERR								 (-21)
#define IFLYTEK_DRC_UI_ENDGAIN_Y_ERR								 (-22)

/*******************************参数定义************************************/
#define IFLYTEK_AUTOVOLUME_SECTIONS                                           (6)
#define IFLYTEK_AUTOVOLUME_MAX_POINT                 (IFLYTEK_AUTOVOLUME_SECTIONS + 1)

#define IFLYTEK_AUTOVOLUME_SAMPLERATE                                    (48000.0)
#define IFLYTEK_AUTOVOLUME_MAX_POINT_VALUE                                     (0)
#define IFLYTEK_AUTOVOLUME_MIN_POINT_VALUE                                  (-100)

#define IFLYTEK_AUTOVOLUME_MAX_OUTPUT_DB                                     (100)
#define IFLYTEK_AUTOVOLUME_MIN_OUTPUT_DB                                    (-100)

#define IFLYTEK_AUTOVOLUME_USEPOINTS_MAX_NUM                                   (6)
#define IFLYTEK_AUTOVOLUME_USEPOINTS_MIN_NUM                                   (2)

#define IFLYTTEK_MAX_DOT													   (6)
/***********参数结构体定义*************/

//支持的采样率
typedef enum {
	DRC_SAMPLERATE_16000 = 16000,
	DRC_SAMPLERATE_48000 = 48000
}DRC_SAMPLERATE_E;
/***********参数结构体定义*************/
typedef enum {
	DRC_TYPE_PEAK = 0,
	DRC_TYPE_RMS = 1
}DRC_TYPE_E;

typedef struct _tagDrcDot
{
	float X;//(单位:Db)
	float Y;//(单位:Db)
	float W;//(单位:Db)
}struDrcDot, *pstDrcDot;

typedef struct _tagDrcPrm
{
	int iEnable;		//0/1
	float Fs;	        //采样率(单位:Hz)
	float At;			//启动时间(单位:s)
	float Rt;			//释放时间(单位:s)
	DRC_TYPE_E Type;    //检测类型
	float RmsTime;      //RMS检测窗长时间,单位,秒(s)
	int SegNum;			//DRC段数
	struDrcDot Dot[IFLYTTEK_MAX_DOT];
}struDrcPrm, *pstDrcPrm;


typedef struct _tagAutoVolumePrm2
{
	struDrcPrm AutoVolumePrmLr;			//左右声道
	struDrcPrm AutoVolumePrmLfe;		//Lfe声道
}struDrcPrm2, *pstDrcPrm2;

typedef struct
{
	int WidthX;
	int HeightY;
	float startXGain;
	float endXGain;
	float startYGain;
	float endYGain;
}struUIDrcInfo;

void DrcDraw(struDrcPrm * pstDrcPrm, struUIDrcInfo* XYData, float* Y);
float DrcCalcYToDb(struUIDrcInfo* XYData, int y);		//增加DRC前缀
float DrcCalcXToDb(struUIDrcInfo* XYData, int x);
int DrcCalcDbToY(struUIDrcInfo* XYData, float fdBGain);
int DrcCalcDbToX(struUIDrcInfo* XYData, float fdBGain);

/*************************** Drc End ***************************/

/*************************** Bin File ***************************/
/************************** return code **************************/
#define IFLYTEK_BIN_OK						(0)
#define IFLYTEK_BIN_FILE_PATH_NULL			(-1)
#define IFLYTEK_BIN_TARGET_NULL				(-2)
#define IFLYTEK_BIN_WRITE_FILE_ERR			(-3)
#define IFLYTEK_BIN_READ_FILE_ERR		    (-4)

/** 参数结构体定义 **/
typedef struct _stru_BassBoostPrm
{
    int		iEnable;//使能开关(0:关闭,1:开启)
	float   fFs;
	float   fDbGain;
	float   fFreqHz;
}struBassBoostPrm, *pstBassBoostPrm;

typedef struct _stru_TrebleBoostPrm
{
    int		 iEnable;//使能开关(0:关闭,1:开启)
	float    fFs;
	float    fDbGain;
	float    fFreqHz;
}struTrebleBoostPrm, *pstTrebleBoostPrm;

//音量控制结构体
typedef struct _GainPrm
{
	int    	iEnable;			//使能开关
	float 	dSampleRate;		//采样率
	float 	dVolume;			//音量大小(-100~0)db
}struGainPrm, *pstGainPrm;

typedef struct _IFLYTEK_Audio_Prm_T
{
	struBassBoostPrm   BassBoostPrm;
	struTrebleBoostPrm TrebleoostPrm;
	struPeqPrm         PeqPrm;
    struDrcPrm         DrcPrm;  //DRC参数
	struGainPrm        GainPrm;
	//添加其他算法参数定义
    
}IFLYTEK_StruAudioPrm;
/************************** bin file api **************************/
int writeToBinFile(const char * path, IFLYTEK_StruAudioPrm * target);
int readFromBinFile(const char * path, IFLYTEK_StruAudioPrm *target);
/*************************** Bin File End ***************************/

#endif